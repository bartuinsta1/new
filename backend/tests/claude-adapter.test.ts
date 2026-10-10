// ClaudeStoryLLM'in Claude API'ye gönderdiği isteğin biçimi — ağ olmadan, sahte istemciyle.
import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { ClaudeStoryLLM } from "../supabase/functions/_shared/engine/llm.ts";
import { baseRequest, goodStory } from "./fake-llm.ts";

type Captured = Record<string, unknown> & { output_config: { effort: string; format: unknown }; system: { cache_control?: unknown }[] };

function stubClient(response: Record<string, unknown>) {
  const calls: Captured[] = [];
  const client = {
    messages: {
      parse: async (params: Captured) => {
        calls.push(params);
        return response;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const okResponse = (parsed: unknown) => ({
  stop_reason: "end_turn", stop_details: null, parsed_output: parsed,
  usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 },
});

test("masal isteği: Haiku 5.5, düşük efor, JSON şeması, önbellekli sistem promptu, sampling yok", async () => {
  const { client, calls } = stubClient(okResponse(goodStory()));
  const llm = new ClaudeStoryLLM({ client });
  const r = await llm.writeStory(baseRequest);
  assert.ok(r.ok);
  const p = calls[0];
  assert.equal(p.model, "claude-haiku-5-5");
  assert.equal(p.output_config.effort, "low");
  assert.ok(p.output_config.format, "yapılandırılmış çıktı biçimi yok");
  assert.deepEqual(p.system[0].cache_control, { type: "ephemeral" });
  for (const k of ["temperature", "top_p", "top_k", "thinking"]) assert.ok(!(k in p), `${k} gönderilmemeli`);
  assert.ok(!JSON.stringify(p.system).includes("Ayşe"), "çocuğa özel veri sistem promptunda");
  assert.match(JSON.stringify(p.messages), /Ayşe/);
});

test("refusal ve max_tokens başarısızlık olarak döner (sunucu yedeği yok)", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const { client } = stubClient({ ...okResponse(null), stop_reason, stop_details: { category: "general_harms" } });
    const r = await new ClaudeStoryLLM({ client }).writeStory(baseRequest);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, stop_reason);
  }
});

test("API hatası yakalanır, çağırana fırlamaz", async () => {
  const client = { messages: { parse: async () => { throw new Error("boom"); } } } as unknown as Anthropic;
  const r = await new ClaudeStoryLLM({ client }).writeStory(baseRequest);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "api_error");
});

test("moderasyon isteği: masal <story> veri bloğunda, izinler bildirilir", async () => {
  const { client, calls } = stubClient(okResponse({ verdict: "safe", categories: [], reason: "ok" }));
  const r = await new ClaudeStoryLLM({ client }).moderate("Bir varmış bir yokmuş…", "tr", ["gentle loss"]);
  assert.ok(r.ok);
  const content = JSON.stringify(calls[0].messages);
  assert.match(content, /<story>/);
  assert.match(content, /gentle loss/);
  assert.equal(calls[0].model, "claude-haiku-5-5");
});
