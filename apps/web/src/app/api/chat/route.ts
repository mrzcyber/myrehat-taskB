import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { CONCIERGE_PROVIDER_OPTIONS, CONCIERGE_SYSTEM_PROMPT, getConciergeModel } from "@/lib/waha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Web chat for the same concierge the WAHA webhook uses (OpenRouter, server-side key).
export async function POST(request: Request) {
  const model = getConciergeModel();
  if (!model) {
    return Response.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { messages?: UIMessage[] };
  const result = streamText({
    model,
    system: CONCIERGE_SYSTEM_PROMPT,
    messages: await convertToModelMessages(body.messages ?? []),
    maxOutputTokens: 600,
    providerOptions: CONCIERGE_PROVIDER_OPTIONS,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
