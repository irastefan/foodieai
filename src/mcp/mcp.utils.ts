import { randomUUID } from "crypto";

export type McpContent = { type: "text"; text: string };

export type McpResult = {
  content: McpContent[];
  isError: false;
  data?: unknown;
  meta?: Record<string, unknown>;
};

export class McpHandledError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export function throwMcpError(code: number, message: string, data?: unknown): never {
  throw new McpHandledError(code, message, data);
}

export function buildMcpResult(
  text: string,
  json?: unknown,
  meta?: Record<string, unknown>,
): McpResult {
  const content: McpContent[] = [{ type: "text", text }];
  if (json !== undefined) {
    content.push({
      type: "text",
      text: typeof json === "string" ? json : JSON.stringify(json, null, 2),
    });
  }
  if (meta !== undefined) {
    content.push({ type: "text", text: JSON.stringify({ _meta: meta }) });
  }
  return { content, isError: false, data: json, meta };
}

export function buildMcpErrorResult(
  message: string,
  meta?: Record<string, unknown>,
  data?: unknown,
) {
  const content: McpContent[] = [{ type: "text", text: message }];
  return {
    content,
    isError: true as const,
    ...(meta ? { meta } : {}),
    ...(data ? { data } : {}),
  };
}

export function newRequestId() {
  return randomUUID();
}
