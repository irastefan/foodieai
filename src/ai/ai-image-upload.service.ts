import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { File as GcsFile, Storage } from "@google-cloud/storage";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { extname, join } from "path";

type UploadedImageResult = {
  objectKey: string;
  imageUrl: string;
  expiresAt: string | null;
  contentType: string;
  size: number;
};

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

@Injectable()
export class AiImageUploadService {
  private storageClient: Storage | null = null;

  async uploadImage(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<UploadedImageResult> {
    if (!file) {
      throw new BadRequestException({
        code: "FILE_REQUIRED",
        message: "Image file is required",
      });
    }

    const contentType = file.mimetype?.trim().toLowerCase();
    if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) {
      throw new BadRequestException({
        code: "UNSUPPORTED_IMAGE_TYPE",
        message: "Supported image types: JPEG, PNG, WEBP, GIF",
      });
    }

    const maxFileBytes = this.getMaxFileBytes();
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new BadRequestException({
        code: "INVALID_FILE_SIZE",
        message: "Uploaded image is empty",
      });
    }
    if (file.size > maxFileBytes) {
      throw new PayloadTooLargeException({
        code: "PAYLOAD_TOO_LARGE",
        message: `Image exceeds configured limit of ${maxFileBytes} bytes`,
      });
    }

    const bucketName = process.env.GCS_UPLOAD_BUCKET?.trim();
    if (!bucketName) {
      throw new ServiceUnavailableException("GCS_UPLOAD_BUCKET is not configured");
    }

    const objectKey = this.buildObjectKey(userId, file.originalname, contentType);
    const storage = this.getStorageClient();
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(objectKey);
    const tempFilePath = join(tmpdir(), `${randomUUID()}.${this.resolveExtension(file.originalname, contentType)}`);

    await fs.writeFile(tempFilePath, file.buffer);
    try {
      await bucket.upload(tempFilePath, {
        destination: objectKey,
        resumable: false,
        validation: false,
        contentType,
        metadata: {
          cacheControl: "private, max-age=900",
          contentDisposition: "inline",
          metadata: {
            uploadedBy: userId,
          },
        },
      });
    } finally {
      await fs.rm(tempFilePath, { force: true }).catch(() => undefined);
    }

    const { imageUrl, expiresAt } = await this.resolveDownloadUrl(bucketName, gcsFile, objectKey);

    return {
      objectKey,
      imageUrl,
      expiresAt,
      contentType,
      size: file.size,
    };
  }

  private async resolveDownloadUrl(
    bucketName: string,
    gcsFile: GcsFile,
    objectKey: string,
  ) {
    const isPublic = (process.env.GCS_UPLOAD_PUBLIC ?? "").trim().toLowerCase() === "true";
    if (isPublic) {
      return {
        imageUrl: `https://storage.googleapis.com/${bucketName}/${this.encodeObjectKey(objectKey)}`,
        expiresAt: null,
      };
    }

    const ttlSeconds = this.getSignedUrlTtlSeconds();
    const expiresAtMs = Date.now() + ttlSeconds * 1000;
    const [imageUrl] = await gcsFile.getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAtMs,
    });

    return {
      imageUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  private getStorageClient() {
    if (!this.storageClient) {
      this.storageClient = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
      });
    }
    return this.storageClient;
  }

  private getMaxFileBytes() {
    return this.parsePositiveInt(process.env.GCS_UPLOAD_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES);
  }

  private getSignedUrlTtlSeconds() {
    return this.parsePositiveInt(process.env.GCS_UPLOAD_URL_TTL_SECONDS, DEFAULT_SIGNED_URL_TTL_SECONDS);
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value?.trim() || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private buildObjectKey(userId: string, originalName: string | undefined, contentType: string) {
    const prefix = (process.env.GCS_UPLOAD_PATH_PREFIX?.trim() || "ai-input-images").replace(/^\/+|\/+$/g, "");
    const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]+/g, "_") || "anonymous";
    const now = new Date();
    const extension = this.resolveExtension(originalName, contentType);

    return [
      prefix,
      safeUserId,
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
      `${randomUUID()}.${extension}`,
    ].join("/");
  }

  private resolveExtension(originalName: string | undefined, contentType: string) {
    const originalExtension = extname(originalName || "").replace(".", "").trim().toLowerCase();
    if (originalExtension) {
      return originalExtension;
    }

    if (contentType === "image/jpeg") return "jpg";
    if (contentType === "image/png") return "png";
    if (contentType === "image/webp") return "webp";
    if (contentType === "image/gif") return "gif";
    return "bin";
  }

  private encodeObjectKey(objectKey: string) {
    return objectKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }
}
