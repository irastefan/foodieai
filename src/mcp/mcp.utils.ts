import { randomUUID } from "crypto";

export type McpContent =
  | { type: "text"; text: string }
  | { type: "json"; json: unknown };

export type McpResult = {
  content: McpContent[];
  isError: false;
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
    content.push({ type: "json", json });
  }
  if (meta !== undefined) {
    content.push({ type: "json", json: { _meta: meta } });
  }
  return { content, isError: false };
}

export function newRequestId() {
  return randomUUID();
}
