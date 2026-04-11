import { BadRequestException, HttpStatus, PayloadTooLargeException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as express from "express";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/errors/http-exception.filter";
import { HttpLoggingInterceptor } from "./common/logging/http-logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const bodyLimit = process.env.BODY_LIMIT?.trim() || "20mb";
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173,https://irastefan.github.io")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const shouldLogAiRequest =
      req.method === "POST" && (req.path === "/v1/ai/responses" || req.path === "/v1/ai/uploads/image");
    if (shouldLogAiRequest) {
      console.error("Incoming AI response request", {
        method: req.method,
        path: req.originalUrl || req.url,
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
      });
    }
    next();
  });
  app.useBodyParser("json", { limit: bodyLimit });
  app.useBodyParser("urlencoded", { extended: true, limit: bodyLimit });
  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!error || typeof error !== "object") {
      next(error);
      return;
    }

    const record = error as Record<string, unknown>;
    const isPayloadTooLarge =
      record.type === "entity.too.large" ||
      record.status === HttpStatus.PAYLOAD_TOO_LARGE ||
      record.statusCode === HttpStatus.PAYLOAD_TOO_LARGE;

    if (isPayloadTooLarge) {
      console.error("Request body too large", {
        method: req.method,
        path: req.originalUrl || req.url,
        limit: bodyLimit,
        length: req.headers["content-length"],
      });

      throw new PayloadTooLargeException({
        code: "PAYLOAD_TOO_LARGE",
        message: `Request body exceeds configured limit of ${bodyLimit}`,
      });
    }

    const isJsonParseError =
      record.type === "entity.parse.failed" ||
      record.status === HttpStatus.BAD_REQUEST ||
      record.statusCode === HttpStatus.BAD_REQUEST;

    if (isJsonParseError) {
      console.error("Request body parse failed", {
        method: req.method,
        path: req.originalUrl || req.url,
        length: req.headers["content-length"],
        message: typeof record.message === "string" ? record.message : undefined,
      });

      throw new BadRequestException({
        code: "BAD_REQUEST",
        message: "Invalid JSON request body",
      });
    }

    next(error);
  });
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("FoodieAI API")
    .setDescription("FoodieAI backend API")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        in: "header",
      },
      "bearer",
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  const port = Number(process.env.PORT || 8080);
  await app.listen(port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  console.error("Application bootstrap failed", error);
  process.exit(1);
});
