# MyRehat — Task B

Book homestays directly with hosts, plus **BuyHomestay**: a marketplace for properties, land, Airbnb profiles and Airbnb businesses.

Monorepo scaffolded with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack): Next.js (web) · Elysia on Bun (server) · oRPC · Better-Auth · Drizzle + PostgreSQL · AI SDK v7 · Turborepo · Biome.

| Feature | Where |
| --- | --- |
| **F1** BuyHomestay listings — form (title, price, location, 4 categories, WhatsApp), login required to submit, public list | `/listings`, `/listings/new`, `packages/api/src/routers/listing.ts` |
| **F2** WAHA concierge webhook — `POST /api/webhooks/waha` → validate → `generateText` → `{ to, reply }` | `apps/web/src/app/api/webhooks/waha/route.ts`, `apps/web/src/lib/waha.ts` |
| **F3** Polish listing descriptions with `ai-sdk-provider-opencode-sdk` | `scripts/polish.ts` |
| **F4** Hero "Book homestays directly with hosts", mobile-first | `apps/web/src/app/page.tsx` |

## Project structure

```
apps/
  web/        Next.js app (UI, F2 webhook, /api/chat) — port 3001
  server/     Elysia API (oRPC at /rpc, Better-Auth at /api/auth) — port 3000
packages/
  api/        oRPC routers + shared Zod schemas (listing validation)
  auth/       Better-Auth config
  db/         Drizzle schema (auth tables, listing table + category enum)
  ui/         shared shadcn/ui components
scripts/
  polish.ts   F3 CLI
```

The browser only talks to the **web** origin: `next.config.ts` rewrites `/rpc/*` and `/api/auth/*` to the server container, so auth cookies stay first-party.

## Getting started

Requirements: Node ≥ 22, pnpm 11, Bun ≥ 1.2, a PostgreSQL database.

```bash
pnpm install
```

The committed `apps/web/.env` and `apps/server/.env` contain **build-time placeholders only**. Put real values in git-ignored `.env.local` files:

`apps/server/.env.local`
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/db
BETTER_AUTH_SECRET=<random string, 32+ chars>
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
GOOGLE_GENERATIVE_AI_API_KEY=placeholder
```

`apps/web/.env.local`
```env
NODE_ENV=development
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free
# optional: require an X-Api-Key header on the webhook
# WAHA_WEBHOOK_SECRET=
```

Create the tables, then start both apps:

```bash
cd packages/db && pnpm exec drizzle-kit push   # `pnpm db:push` needs an interactive terminal
cd ../.. && pnpm dev
```

Web: http://localhost:3001 · API: http://localhost:3000

## Tests and type checks

```bash
bunx vitest run       # or: pnpm test
pnpm check-types      # every workspace package + root tsc (scripts and tests)
```

All AI calls in the tests use `MockLanguageModelV4` from `ai/test`, so the tests need no network, API key, database or OpenCode server.

| File | Covers |
| --- | --- |
| `apps/web/src/lib/waha.test.ts` | Webhook validation (valid, extra WAHA fields, missing/empty/too-long fields, wrong event), reply format exactly `{ to, reply }`, fallback when the model fails or returns nothing, route 400/401 responses |
| `packages/api/src/schemas/listing.test.ts` | All 4 categories accepted, `"Rent Villa"` rejected, exact-match only, DB enum in sync with the form, WhatsApp normalisation, price and field validation |
| `scripts/polish.test.ts` | Polished output cleanup, prompt contents, original kept on empty output, empty input rejected, errors propagated, OpenCode wiring (base URL, Basic auth, model id) |

## F2 — WAHA webhook

```bash
curl -X POST http://localhost:3001/api/webhooks/waha \
  -H 'Content-Type: application/json' \
  -d '{"event":"message","session":"default","payload":{"from":"6281234567890@c.us","body":"Halo, ada homestay di Ubud untuk 2 orang?"}}'
```

```json
{ "to": "6281234567890@c.us", "reply": "Halo! ..." }
```

| Request | Response |
| --- | --- |
| Valid `message` event | `200 { to, reply }` — `to` is the sender, `reply` from the AI |
| AI error / rate limit / no API key | `200 { to, reply }` with a friendly fallback reply (contract kept) |
| Invalid JSON | `400 { error: "Invalid JSON" }` |
| Missing `from` / `body`, empty body, body > 4000 chars, event ≠ `message` | `400 { error, issues: [{ path, message }] }` |
| `WAHA_WEBHOOK_SECRET` set and `X-Api-Key` missing/wrong | `401` |

Free OpenRouter models are often reasoning models; reasoning is disabled (`providerOptions.openrouter.reasoning.enabled = false`) so the token budget isn't spent on thinking and the reply is never empty. The same concierge powers the web chat at `/ai` (`/api/chat`).

## F3 — polish listing descriptions

Runs against an [OpenCode](https://opencode.ai) 2.x server through `ai-sdk-provider-opencode-sdk`:

```bash
OPENCODE_PASSWORD=secret npx @opencode/cli@2.0.24 serve --port 4096   # separate terminal

OPENCODE_PASSWORD=secret pnpm polish "villa 3 kamar dkt pantai canggu ada kolam" \
  --title "Villa Canggu" --category "Buy Property" --location "Canggu, Bali"
echo "raw description" | pnpm polish
```

Env: `OPENCODE_BASE_URL` (default `http://127.0.0.1:4096`), `OPENCODE_PASSWORD`, `OPENCODE_MODEL` (default `opencode/nemotron-3.5-lightning-free`). The script keeps every fact, adds none, and falls back to the original text if the model returns nothing. Without a server it exits with code 1 and a readable error.

## Deployment (Docker / Dokploy)

`docker-compose.yml` runs `web` and `server`. Real values are injected by the platform; the committed `.env` files only make the build succeed. Required environment:

| Variable | Service | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | web (build + runtime) | Public URL of the web app |
| `BETTER_AUTH_URL` | server | Same public URL |
| `DATABASE_URL` | server | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | server | Random string, 32+ chars |
| `OPENROUTER_API_KEY` | web | OpenRouter key |
| `OPENROUTER_MODEL` | web | Any `:free` model, e.g. `nvidia/nemotron-3.5-lightning:free` |

Point the public domain at service `web`, port `3001`. Cookies use `sameSite: "lax", secure: false`, so the app works over plain http.

The prompts used to build this project are in [`PROMPT_LOG.md`](PROMPT_LOG.md).
