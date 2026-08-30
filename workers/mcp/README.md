# Household OS MCP server

A Cloudflare Worker that exposes the Household OS assistant tool surface to
external MCP clients (Claude, ChatGPT, Cursor, …), modeled on
[sudowealth/schwab-mcp](https://github.com/sudowealth/schwab-mcp):
[`workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider)
fronts the worker with dynamic client registration, PKCE, and KV token
storage, and `/mcp` serves MCP over streamable HTTP (stateless handler — no
Durable Objects, so the Workers free plan is enough).

## How it works

```
MCP client ──OAuth──▶ worker /authorize ──▶ app consent page (passkey sign-in)
                                   ◀──── one-time code ─────┘
worker /callback ──POST /api/mcp/exchange──▶ app issues grant token
MCP client ──/mcp tool call──▶ worker ──POST /api/mcp/call──▶ app executes
                                              as the member, under RLS
```

The worker holds **no household logic and no Supabase credentials**. It
fetches the tool manifest from `GET /api/mcp/tools` (names, descriptions,
JSON Schemas) and relays `tools/call` to `POST /api/mcp/call` with the
member's grant token. The app re-validates every call and executes it through
the same command layer the UI uses, so RLS and the in-database authorization
checks stay in force. The tool contract lives only in the app
(`src/lib/ai/definitions`); the worker cannot drift from it.

## Deploying (do this together, not from CI)

1. `wrangler kv namespace create OAUTH_KV` and paste the id into
   `wrangler.jsonc`.
2. Set `HOUSEHOLD_APP_URL` in `wrangler.jsonc` to the app's origin.
3. In the **app's** environment (Vercel), set:
   - `MCP_GRANT_SECRET` — `openssl rand -base64 32`
   - `SUPABASE_JWT_SECRET` — the project's JWT signing secret (legacy HS256)
   - `MCP_ALLOWED_REDIRECT_ORIGINS` — the worker origin, e.g.
     `https://household-os-mcp.<account>.workers.dev`
4. `pnpm --dir workers/mcp deploy`
5. Connect a client to `https://<worker>/mcp`; it will walk the OAuth flow
   and land on the app's consent page.

Local check without deploying: `pnpm --dir workers/mcp typecheck` and
`pnpm --dir workers/mcp exec wrangler deploy --dry-run`.

## Revocation

Grant tokens live 90 days. Rotating `MCP_GRANT_SECRET` in the app
invalidates every outstanding grant immediately (clients just reconnect).
Per-grant revocation UI is a planned follow-up.
