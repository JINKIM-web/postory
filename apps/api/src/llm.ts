import OpenAI from "openai";
import type { z } from "zod";
import { toStrictJsonSchema, type UsageInfo, type UsageOperation } from "@postory/shared";
import { config, isMock } from "./config.js";

// LLM 호출 계층 (계획서 구현순서 8): 모델 분리, Structured Output, 재시도·타임아웃, 사용량 기록.
// 키가 없으면 각 단계가 넘겨준 mock()의 결과를 돌려준다.

export type Tier = "light" | "main";

export interface JsonCall<T> {
  operation: UsageOperation;
  tier: Tier;
  schemaName: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  images?: string[];
  mock: () => T;
}

export interface JsonResult<T> {
  data: T;
  usage: UsageInfo;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI({ apiKey: config.openaiApiKey, timeout: config.requestTimeoutMs, maxRetries: 0 });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) return err.status === undefined || err.status === 429 || err.status >= 500;
  return err instanceof Error && /timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(err.message);
}

export class LlmError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export async function callJson<T>(call: JsonCall<T>): Promise<JsonResult<T>> {
  const model = call.tier === "main" ? config.modelMain : config.modelLight;

  if (isMock()) {
    return {
      data: call.schema.parse(call.mock()),
      usage: { operation: call.operation, model: "mock", inputTokens: 0, outputTokens: 0, imageCount: call.images?.length ?? 0, estimatedCostUsd: 0 },
    };
  }

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: call.user }];
  for (const url of call.images ?? []) content.push({ type: "image_url", image_url: { url, detail: "low" } });

  const maxAttempts = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model,
        // 추론 모델에만 추론 강도를 지정한다 (다른 모델은 이 옵션을 거부함)
        ...(/^(gpt-5|o\d)/.test(model) ? { reasoning_effort: config.reasoningEffort[call.tier] as OpenAI.ReasoningEffort } : {}),
        messages: [
          { role: "system", content: call.system },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: call.schemaName, strict: true, schema: toStrictJsonSchema(call.schema) },
        },
      });
      const message = completion.choices[0]?.message;
      if (message?.refusal) throw new LlmError(`AI가 요청을 거절했습니다: ${message.refusal}`, false);
      const raw = message?.content;
      if (!raw) throw new LlmError("AI 응답이 비어 있습니다.", true);

      const parsed = call.schema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new LlmError("AI 응답 형식이 올바르지 않습니다.", true);

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const price = config.price[call.tier];
      return {
        data: parsed.data,
        usage: {
          operation: call.operation,
          model,
          inputTokens,
          outputTokens,
          imageCount: call.images?.length ?? 0,
          estimatedCostUsd: (inputTokens * price.input + outputTokens * price.output) / 1_000_000,
        },
      };
    } catch (err) {
      const retryable = err instanceof LlmError ? err.retryable : isRetryable(err);
      if (!retryable || attempt >= maxAttempts) {
        if (err instanceof LlmError) throw err;
        throw new LlmError(err instanceof Error ? err.message : "AI 호출에 실패했습니다.", retryable);
      }
      // 지수 백오프 (명세서 40.2)
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}
