import { describe, expect, it } from "vitest";
import { MasterStory } from "./masterStory.js";
import { toStrictJsonSchema } from "./jsonSchema.js";

describe("toStrictJsonSchema", () => {
  it("모든 객체에 required 전체와 additionalProperties:false를 넣는다", () => {
    const schema = toStrictJsonSchema(MasterStory) as any;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(Object.keys(schema.properties));
    const fact = schema.properties.confirmedFacts.items;
    expect(fact.additionalProperties).toBe(false);
    expect(fact.required).toEqual(["text", "source"]);
    expect(JSON.stringify(schema)).not.toContain("$schema");
  });
});
