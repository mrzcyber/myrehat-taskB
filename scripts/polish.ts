/**
 * F3 — polish a BuyHomestay listing description with an LLM served by an OpenCode 2.x server
 * (via `ai-sdk-provider-opencode-sdk`).
 *
 * Usage:
 *   OPENCODE_PASSWORD=secret npx @opencode/cli@2.0.24 serve --port 4096   # in another terminal
 *   OPENCODE_PASSWORD=secret pnpm polish "villa 3 kamar dkt pantai canggu ada kolam" \
 *     --title "Villa Canggu" --category "Buy Property" --location "Canggu, Bali"
 *   echo "raw description" | pnpm polish
 *
 * Env: OPENCODE_BASE_URL (default http://127.0.0.1:4096), OPENCODE_PASSWORD,
 *      OPENCODE_MODEL (default opencode/nemotron-3.5-lightning-free).
 */
import { parseArgs } from "node:util";

import { generateText, type LanguageModel } from "ai";
import { createOpencode } from "ai-sdk-provider-opencode-sdk";
import z from "zod";

export const DEFAULT_OPENCODE_BASE_URL = "http://127.0.0.1:4096";
export const DEFAULT_OPENCODE_MODEL = "opencode/nemotron-3.5-lightning-free";

export const POLISH_SYSTEM_PROMPT = `You are a copywriter for MyRehat BuyHomestay, a marketplace where owners sell
properties, land for homestays, Airbnb profiles and Airbnb businesses directly to buyers.
Rewrite the listing description so it is clear, warm and professional.
Rules:
- Keep every fact from the original. Never add facts, prices, amenities or numbers that are not in it.
- 2 to 4 sentences, plain text only: no markdown, no bullet points, no surrounding quotes.
- Write in the same language as the original description (Indonesian or English).
- Output only the rewritten description.`;

export const polishInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description must not be empty")
    .max(2000, "Description is too long"),
  title: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
});

export type PolishInput = z.input<typeof polishInputSchema>;

export function buildPolishPrompt(input: z.output<typeof polishInputSchema>): string {
  const context = [
    input.title && `Title: ${input.title}`,
    input.category && `Category: ${input.category}`,
    input.location && `Location: ${input.location}`,
  ].filter(Boolean);

  return [
    ...(context.length ? ["Listing context:", ...context, ""] : []),
    "Original description:",
    input.description,
  ].join("\n");
}

/** Models sometimes wrap the answer in quotes or code fences despite instructions. */
export function cleanPolishedText(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\s*|\s*```$/gi, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
}

export async function polishDescription({
  model,
  ...rawInput
}: PolishInput & { model: LanguageModel }): Promise<string> {
  const input = polishInputSchema.parse(rawInput);
  const { text } = await generateText({
    model,
    system: POLISH_SYSTEM_PROMPT,
    // No maxOutputTokens: OpenCode owns generation settings and ignores it with a warning.
    prompt: buildPolishPrompt(input),
  });
  // Never lose the owner's text: an empty answer keeps the original.
  return cleanPolishedText(text) || input.description;
}

export function createOpencodeModel(env: NodeJS.ProcessEnv = process.env) {
  const headers: Record<string, string> = {};
  if (env.OPENCODE_PASSWORD) {
    const credentials = Buffer.from(`opencode:${env.OPENCODE_PASSWORD}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  const opencode = createOpencode({
    baseUrl: env.OPENCODE_BASE_URL || DEFAULT_OPENCODE_BASE_URL,
    clientOptions: { headers },
  });

  return {
    model: opencode(env.OPENCODE_MODEL || DEFAULT_OPENCODE_MODEL),
    dispose: () => opencode.dispose(),
  };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: "string" },
      category: { type: "string" },
      location: { type: "string" },
    },
  });

  const description = positionals.join(" ") || (await readStdin());
  const { model, dispose } = createOpencodeModel();
  try {
    console.log(await polishDescription({ model, description, ...values }));
  } finally {
    await dispose();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("; ")
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`polish failed: ${message}`);
    process.exit(1);
  });
}
