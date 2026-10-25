import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import z from "zod";

export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-lightning:free";

export const FALLBACK_REPLY =
  "Maaf, concierge MyRehat sedang sibuk. Silakan coba lagi sebentar lagi. / Sorry, our concierge is busy right now, please try again shortly.";

export const CONCIERGE_SYSTEM_PROMPT = `You are the MyRehat WhatsApp concierge.
MyRehat lets guests book homestays directly with hosts (no middleman fees), and runs BuyHomestay,
a marketplace in 4 categories: Buy Property, Buy land to build homestay, Buy Airbnb Profile, Buy Airbnb Business.
Rules:
- Reply in the same language as the guest (Indonesian or English).
- Keep it short: at most 3 sentences, plain text, no markdown.
- Never invent prices, availability or listings; point the guest to the listings page or the host's WhatsApp instead.`;

// Free models are often reasoning models: without this they can spend the whole
// token budget thinking and return empty text.
export const CONCIERGE_PROVIDER_OPTIONS = { openrouter: { reasoning: { enabled: false } } };

// WAHA sends many more fields (session, id, fromMe, ...); we only need these and ignore the rest.
export const wahaWebhookSchema = z
  .object({
    event: z.literal("message", { error: 'Only "message" events are supported' }),
    payload: z
      .object({
        from: z.string({ error: "payload.from is required" }).trim().min(1, "payload.from is required"),
        body: z
          .string({ error: "payload.body is required" })
          .trim()
          .min(1, "payload.body must not be empty")
          .max(4000, "payload.body is too long"),
      })
      .loose(),
  })
  .loose();

export type WahaWebhook = z.output<typeof wahaWebhookSchema>;

export type ConciergeReply = { to: string; reply: string };

export type ParseResult =
  | { ok: true; data: WahaWebhook }
  | { ok: false; error: string; issues: { path: string; message: string }[] };

export function parseWahaWebhook(input: unknown): ParseResult {
  const result = wahaWebhookSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: "Invalid WAHA webhook payload",
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export function toConciergeReply(to: string, reply: string): ConciergeReply {
  return { to, reply };
}

export async function buildConciergeReply({
  model,
  from,
  body,
  timeoutMs = 20_000,
}: {
  model: LanguageModel;
  from: string;
  body: string;
  timeoutMs?: number;
}): Promise<ConciergeReply> {
  try {
    const { text } = await generateText({
      model,
      system: CONCIERGE_SYSTEM_PROMPT,
      prompt: body,
      // Headroom for models that ignore the reasoning switch.
      maxOutputTokens: 600,
      providerOptions: CONCIERGE_PROVIDER_OPTIONS,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    const reply = text.trim();
    return toConciergeReply(from, reply || FALLBACK_REPLY);
  } catch (error) {
    // Free OpenRouter models are often rate-limited; keep the {to, reply} contract regardless.
    console.error("[waha] AI generation failed:", error);
    return toConciergeReply(from, FALLBACK_REPLY);
  }
}

export function getConciergeModel(env: NodeJS.ProcessEnv = process.env): LanguageModel | null {
  if (!env.OPENROUTER_API_KEY) return null;
  const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  return openrouter.chat(env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL);
}
