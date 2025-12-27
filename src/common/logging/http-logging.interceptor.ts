import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable, tap } from "rxjs";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const start = Date.now();

    const requestLog = {
      method: request.method,
      path: request.originalUrl || request.url,
      headers: this.sanitizeHeaders(request.headers),
      body: this.sanitizeValue(request.body),
    };
    Logger.log(`HTTP request ${JSON.stringify(requestLog)}`, "HttpLogging");

    return next.handle().pipe(
      tap((responseBody) => {
        const response = http.getResponse<Response>();
        const responseLog = {
          statusCode: response.statusCode,
          durationMs: Date.now() - start,
          body: this.sanitizeValue(responseBody),
        };
        Logger.log(`HTTP response ${JSON.stringify(responseLog)}`, "HttpLogging");
      }),
    );
  }

  private sanitizeHeaders(headers: Record<string, unknown>) {
    const redacted = { ...headers };
    for (const key of Object.keys(redacted)) {
      const lower = key.toLowerCase();
      if (
        lower === "authorization" ||
        lower === "cookie" ||
        lower === "set-cookie"
      ) {
        redacted[key] = "[redacted]";
      }
    }
    return redacted;
  }

  private sanitizeValue(value: unknown) {
    const seen = new WeakSet();
    const replacer = (_key: string, val: unknown) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val as object)) {
          return "[circular]";
        }
        seen.add(val as object);
      }
      if (typeof val === "string" && val.length > 2000) {
        return `${val.slice(0, 2000)}...`;
      }
      if (typeof val === "object" && val !== null) {
        const record = val as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          const lower = key.toLowerCase();
          if (
            lower.includes("token") ||
            lower === "password" ||
            lower === "authorization"
          ) {
            record[key] = "[redacted]";
          }
        }
      }
      return val;
    };

    try {
      return JSON.parse(JSON.stringify(value, replacer));
    } catch {
      return "[unserializable]";
    }
  }
}
