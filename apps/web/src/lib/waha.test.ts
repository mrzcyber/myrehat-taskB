import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/waha/route";

import { buildConciergeReply, FALLBACK_REPLY, parseWahaWebhook } from "./waha";

const FROM = "6281234567890@c.us";

function mockModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

function failingModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("429 rate limited");
    },
  });
}

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/waha", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("WAHA webhook validation", () => {
  it("accepts a minimal message payload", () => {
    const result = parseWahaWebhook({ event: "message", payload: { from: FROM, body: "Halo" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.payload).toMatchObject({ from: FROM, body: "Halo" });
  });

  it("accepts a real WAHA payload with extra fields and trims the body", () => {
    const result = parseWahaWebhook({
      id: "evt_1",
      session: "default",
      event: "message",
      payload: { id: "false_628@c.us_ABC", from: FROM, fromMe: false, body: "  Ada homestay di Ubud?  " },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.payload.body).toBe("Ada homestay di Ubud?");
  });

  it.each([
    ["missing event", { payload: { from: FROM, body: "Hi" } }, "event"],
    ["non-message event", { event: "session.status", payload: { from: FROM, body: "Hi" } }, "event"],
    ["missing payload", { event: "message" }, "payload"],
    ["missing from", { event: "message", payload: { body: "Hi" } }, "payload.from"],
    ["empty from", { event: "message", payload: { from: " ", body: "Hi" } }, "payload.from"],
    ["missing body", { event: "message", payload: { from: FROM } }, "payload.body"],
    ["whitespace body", { event: "message", payload: { from: FROM, body: "   " } }, "payload.body"],
    ["body too long", { event: "message", payload: { from: FROM, body: "a".repeat(4001) } }, "payload.body"],
    ["non-string body", { event: "message", payload: { from: FROM, body: 123 } }, "payload.body"],
  ])("rejects %s", (_name, input, path) => {
    const result = parseWahaWebhook(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.path)).toContain(path);
  });

  it.each([null, "hello", 42, []])("rejects a non-object body (%j)", (input) => {
    expect(parseWahaWebhook(input).ok).toBe(false);
  });
});

describe("concierge reply format", () => {
  it("returns exactly {to, reply} with to = sender and a trimmed AI reply", async () => {
    const model = mockModel("  Halo! Ada beberapa homestay di Ubud.  ");
    const result = await buildConciergeReply({ model, from: FROM, body: "Ada homestay di Ubud?" });

    expect(Object.keys(result).sort()).toEqual(["reply", "to"]);
    expect(result).toEqual({ to: FROM, reply: "Halo! Ada beberapa homestay di Ubud." });
  });

  it("sends the guest message to the model with the concierge system prompt", async () => {
    const model = mockModel("ok");
    await buildConciergeReply({ model, from: FROM, body: "Ada homestay di Ubud?" });

    const [call] = model.doGenerateCalls;
    expect(call?.prompt[0]).toMatchObject({ role: "system" });
    expect(JSON.stringify(call?.prompt)).toContain("Ada homestay di Ubud?");
    // Reasoning models must not burn the output budget on thinking (empty reply otherwise).
    expect(call?.providerOptions).toMatchObject({ openrouter: { reasoning: { enabled: false } } });
  });

  it("falls back to a friendly reply when the model fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await buildConciergeReply({ model: failingModel(), from: FROM, body: "Hi" });
    expect(result).toEqual({ to: FROM, reply: FALLBACK_REPLY });
  });

  it("falls back when the model returns empty text", async () => {
    const result = await buildConciergeReply({ model: mockModel("   "), from: FROM, body: "Hi" });
    expect(result).toEqual({ to: FROM, reply: FALLBACK_REPLY });
  });
});

describe("POST /api/webhooks/waha", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(webhookRequest("not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 with issues for an invalid payload", async () => {
    const res = await POST(webhookRequest(JSON.stringify({ event: "message", payload: {} })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid WAHA webhook payload");
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("returns 401 when a secret is configured and the header is wrong", async () => {
    vi.stubEnv("WAHA_WEBHOOK_SECRET", "s3cret");
    const body = JSON.stringify({ event: "message", payload: { from: FROM, body: "Hi" } });
    expect((await POST(webhookRequest(body))).status).toBe(401);
    expect((await POST(webhookRequest(body, { "x-api-key": "nope" }))).status).toBe(401);
  });

  it("returns 200 {to, reply} without calling the AI when no API key is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(
      webhookRequest(JSON.stringify({ event: "message", payload: { from: FROM, body: "Hi" } })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ to: FROM, reply: FALLBACK_REPLY });
  });
});
