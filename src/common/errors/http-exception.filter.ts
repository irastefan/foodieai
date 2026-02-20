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
    return "HTTP_ERROR";
  }
}
