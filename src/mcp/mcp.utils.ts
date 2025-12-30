import { randomUUID } from "crypto";

export type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "resource_link"; name: string; uri: string }
  | { type: "resource"; resource: unknown };

export type McpResult =
  | {
      content: McpContent[];
      isError: false;
      data?: unknown;
      meta?: Record<string, unknown>;
    }
  | {
      content: McpContent[];
      isError: true;
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
  message: string,
  payload?: unknown,
  meta?: Record<string, unknown>,
): McpResult {
  const content: McpContent[] = [
    {
      type: "text",
      text:
        payload === undefined
          ? message
          : `${message}\n\n${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}`,
    },
  ];
  if (meta) {
    content.push({
      type: "text",
      text: JSON.stringify({ _meta: meta }),
    });
  }
  return { content, isError: false, data: payload, meta };
}

export function buildMcpErrorResult(
  message: string,
  meta?: Record<string, unknown>,
  data?: unknown,
): McpResult {
  return {
    content: [
      {
        type: "text",
        text:
          data === undefined
            ? `❌ ${message}`
            : `❌ ${message}\n\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`,
      },
    ],
    isError: true,
    ...(meta ? { meta } : {}),
    ...(data ? { data } : {}),
  };
}

export function newRequestId() {
  return randomUUID();
}
