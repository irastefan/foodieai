export function jsonToTextContent(payload: unknown) {
  return { type: "text", text: JSON.stringify(payload) };
}
