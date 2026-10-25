import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const opencodeMock = vi.hoisted(() => {
  const dispose = vi.fn(async () => {});
  const provider = Object.assign(
    vi.fn((modelId: string) => ({ modelId })),
    { dispose },
  );
  return { createOpencode: vi.fn(() => provider), provider, dispose };
});

vi.mock("ai-sdk-provider-opencode-sdk", () => ({ createOpencode: opencodeMock.createOpencode }));

import {
  buildPolishPrompt,
  cleanPolishedText,
  createOpencodeModel,
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
  POLISH_SYSTEM_PROMPT,
  polishDescription,
} from "./polish";

const RAW = "villa 3 kamar dkt pantai canggu, ada kolam, cocok buat airbnb";

function mockModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 40, text: 40, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

describe("polishDescription", () => {
  it("returns the model's polished text, trimmed and unquoted", async () => {
    const model = mockModel('  "Villa 3 kamar tidur dekat Pantai Canggu dengan kolam renang."  ');
    await expect(polishDescription({ model, description: RAW })).resolves.toBe(
      "Villa 3 kamar tidur dekat Pantai Canggu dengan kolam renang.",
    );
  });

  it("sends the system prompt, listing context and original description to the model", async () => {
    const model = mockModel("Polished.");
    await polishDescription({
      model,
      description: RAW,
      title: "Villa Canggu",
      category: "Buy Airbnb Business",
      location: "Canggu, Bali",
    });

    const [call] = model.doGenerateCalls;
    expect(call?.prompt[0]).toEqual({ role: "system", content: POLISH_SYSTEM_PROMPT });
    const userPrompt = JSON.stringify(call?.prompt[1]);
    for (const expected of ["Villa Canggu", "Buy Airbnb Business", "Canggu, Bali", RAW]) {
      expect(userPrompt).toContain(expected);
    }
  });

  it("keeps the original description when the model returns nothing", async () => {
    await expect(polishDescription({ model: mockModel("  "), description: RAW })).resolves.toBe(
      RAW,
    );
  });

  it("rejects an empty description without calling the model", async () => {
    const model = mockModel("should not be used");
    await expect(polishDescription({ model, description: "   " })).rejects.toThrow(
      "Description must not be empty",
    );
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("propagates model errors so the CLI can fail loudly", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("OpenCode server unreachable");
      },
    });
    await expect(polishDescription({ model, description: RAW })).rejects.toThrow(
      "OpenCode server unreachable",
    );
  });
});

describe("buildPolishPrompt", () => {
  it("includes context lines only when provided", () => {
    expect(buildPolishPrompt({ description: RAW })).toBe(`Original description:\n${RAW}`);
    expect(buildPolishPrompt({ description: RAW, location: "Ubud" })).toBe(
      `Listing context:\nLocation: Ubud\n\nOriginal description:\n${RAW}`,
    );
  });
});

describe("cleanPolishedText", () => {
  it.each([
    ['"Hello"', "Hello"],
    ["“Halo”", "Halo"],
    ["```\nHello\n```", "Hello"],
    ["  plain  ", "plain"],
  ])("cleans %j", (input, expected) => {
    expect(cleanPolishedText(input)).toBe(expected);
  });
});

describe("createOpencodeModel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("connects to the configured OpenCode server with Basic auth and model id", async () => {
    const { model, dispose } = createOpencodeModel({
      OPENCODE_BASE_URL: "http://opencode.test:4096",
      OPENCODE_PASSWORD: "s3cret",
      OPENCODE_MODEL: "opencode/big-pickle",
    });

    expect(opencodeMock.createOpencode).toHaveBeenCalledWith({
      baseUrl: "http://opencode.test:4096",
      clientOptions: {
        headers: { Authorization: `Basic ${Buffer.from("opencode:s3cret").toString("base64")}` },
      },
    });
    expect(opencodeMock.provider).toHaveBeenCalledWith("opencode/big-pickle");
    expect(model).toEqual({ modelId: "opencode/big-pickle" });

    await dispose();
    expect(opencodeMock.dispose).toHaveBeenCalledOnce();
  });

  it("falls back to local defaults without auth", () => {
    createOpencodeModel({});
    expect(opencodeMock.createOpencode).toHaveBeenCalledWith({
      baseUrl: DEFAULT_OPENCODE_BASE_URL,
      clientOptions: { headers: {} },
    });
    expect(opencodeMock.provider).toHaveBeenCalledWith(DEFAULT_OPENCODE_MODEL);
  });
});
