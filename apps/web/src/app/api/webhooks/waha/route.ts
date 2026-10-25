import { timingSafeEqual } from "node:crypto";

import {
  buildConciergeReply,
  FALLBACK_REPLY,
  getConciergeModel,
  parseWahaWebhook,
  toConciergeReply,
} from "@/lib/waha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.WAHA_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = Buffer.from(request.headers.get("x-api-key") ?? "");
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseWahaWebhook(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }

  const { from, body: message } = parsed.data.payload;
  const model = getConciergeModel();
  if (!model) {
    console.warn("[waha] OPENROUTER_API_KEY is not set; returning fallback reply");
    return Response.json(toConciergeReply(from, FALLBACK_REPLY));
  }

  return Response.json(await buildConciergeReply({ model, from, body: message }));
}
