import { z } from "zod";

// OpenAI Structured Output(strict)용 JSON Schema 변환.
// strict 모드는 모든 속성이 required이고 additionalProperties가 false여야 하며,
// 길이·범위 같은 일부 키워드를 지원하지 않으므로 제거한다.

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "default",
]);

type JsonObject = Record<string, unknown>;

function normalize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalize);
  if (!node || typeof node !== "object") return node;

  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node as JsonObject)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = normalize(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties as JsonObject);
    out.additionalProperties = false;
  }
  return out;
}

export function toStrictJsonSchema(schema: z.ZodType): JsonObject {
  return normalize(z.toJSONSchema(schema, { io: "output" })) as JsonObject;
}
