import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logException(exception, request);
    const normalized = this.normalizeException(exception);

    response.status(normalized.status).json({
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
        status: normalized.status,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private normalizeException(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    const multerStatus = this.extractMulterStatus(exception);
    if (multerStatus) {
      return multerStatus;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      const payloadObj =
        typeof payload === "string"
          ? { message: payload }
          : (payload as Record<string, unknown>);

      const message = this.extractMessage(payloadObj, exception.message);
      const code =
        typeof payloadObj.code === "string"
          ? payloadObj.code
          : this.codeByStatus(status);

      const details = this.extractDetails(payloadObj);
      return { status, code, message, ...(details !== undefined ? { details } : {}) };
    }

    if (exception && typeof exception === "object") {
      const record = exception as Record<string, unknown>;
      const status = this.extractStatus(record);
      if (status) {
        const message =
          typeof record.message === "string" && record.message.trim().length > 0
            ? record.message
            : this.defaultMessageByStatus(status);
        const details = this.extractErrorDetails(record);
        return {
          status,
          code: this.codeByStatus(status),
          message,
          ...(details !== undefined ? { details } : {}),
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    };
  }

  private extractMessage(payload: Record<string, unknown>, fallback: string) {
    if (typeof payload.message === "string") {
      return payload.message;
    }
    if (Array.isArray(payload.message)) {
      return payload.message.join("; ");
    }
    return fallback || "Unexpected error";
  }

  private extractDetails(payload: Record<string, unknown>) {
    const clone = { ...payload };
    delete clone.message;
    delete clone.error;
    delete clone.statusCode;
    delete clone.code;
    return Object.keys(clone).length > 0 ? clone : undefined;
  }

  private codeByStatus(status: number) {
    if (status === HttpStatus.BAD_REQUEST) return "BAD_REQUEST";
    if (status === HttpStatus.UNAUTHORIZED) return "UNAUTHORIZED";
    if (status === HttpStatus.FORBIDDEN) return "FORBIDDEN";
    if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
    if (status === HttpStatus.CONFLICT) return "CONFLICT";
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return "PAYLOAD_TOO_LARGE";
    return "HTTP_ERROR";
  }

  private logException(exception: unknown, request: Request) {
    const base = {
      method: request.method,
      path: request.originalUrl || request.url,
      contentType: request.headers["content-type"],
      contentLength: request.headers["content-length"],
    };

    if (exception instanceof HttpException) {
      console.error("HTTP exception", {
        ...base,
        status: exception.getStatus(),
        response: exception.getResponse(),
      });
      return;
    }

    if (exception && typeof exception === "object") {
      const record = exception as Record<string, unknown>;
      console.error("Unhandled exception", {
        ...base,
        name: typeof record.name === "string" ? record.name : undefined,
        code: typeof record.code === "string" ? record.code : undefined,
        message: typeof record.message === "string" ? record.message : undefined,
        type: typeof record.type === "string" ? record.type : undefined,
        status: typeof record.status === "number" ? record.status : undefined,
        statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
        stack: typeof record.stack === "string" ? record.stack : undefined,
      });
      return;
    }

    console.error("Unhandled exception", { ...base, exception });
  }

  private extractStatus(payload: Record<string, unknown>) {
    const candidates = [payload.status, payload.statusCode];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isInteger(candidate)) {
        return candidate;
      }
    }
    return undefined;
  }

  private defaultMessageByStatus(status: number) {
    if (status === HttpStatus.BAD_REQUEST) return "Bad request";
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return "Payload too large";
    return "Unexpected error";
  }

  private extractErrorDetails(payload: Record<string, unknown>) {
    const clone = { ...payload };
    delete clone.message;
    delete clone.error;
    delete clone.statusCode;
    delete clone.status;
    delete clone.code;
    return Object.keys(clone).length > 0 ? clone : undefined;
  }

  private extractMulterStatus(exception: unknown) {
    if (!exception || typeof exception !== "object") {
      return undefined;
    }

    const record = exception as Record<string, unknown>;
    if (record.name !== "MulterError") {
      return undefined;
    }

    if (record.code === "LIMIT_FILE_SIZE") {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        code: "PAYLOAD_TOO_LARGE",
        message: "Uploaded file exceeds configured size limit",
        details: {
          multerCode: record.code,
        },
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      code: "BAD_REQUEST",
      message: typeof record.message === "string" ? record.message : "Invalid multipart upload",
      details: {
        multerCode: record.code,
      },
    };
  }
}
