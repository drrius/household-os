# ADR 0025: AI assistant and external MCP access

- Status: Accepted
- Date: 2026-08-30
- Amends: ADR 0019's zero-cost ceiling and Cloudflare exclusion; ADR 0024's single-package layout

## Context

The household wants to drive the app by asking an AI instead of tapping
through forms — both inside the app and from external AI clients (Claude,
ChatGPT, and other MCP-capable tools). This is an explicit product decision by
the household members, made after version one closed. It touches three
standing decisions: ADR 0019 caps operating cost at CHF 0 and excludes
Cloudflare from the runtime; ADR 0012/0022 limit identity to two provisioned
passkey users; and the privacy posture keeps household content out of third
parties.

## Decision

**One tool contract.** Every action the assistant can take is declared once in
`src/lib/ai/definitions` (Zod schemas, pure and browser-safe) and executed
once in `src/lib/ai/execute` by delegating to the existing command layer.
Commands keep their transactional Postgres functions, idempotency keys, and
in-transaction membership checks; the assistant adds no second write path.

**In-app assistant.** A streaming chat route (`/api/assistant/chat`) built on
the Vercel AI SDK runs as the signed-in member's cookie session. The model is
resolved by a factory (`src/lib/ai/model.ts`) behind `HOUSEHOLD_AI_MODEL`;
OpenAI is the first provider, and swapping providers changes only that
factory. Financial-history tools (expense, refund, settlement, opening
balance, draft confirmation, correction) never auto-execute: the AI SDK's
tool-approval flow renders an in-chat confirmation card, and approvals are
HMAC-signed server-side (`TOOL_APPROVAL_SECRET`) so a crafted client cannot
forge one. This preserves the failure-model rule that no background path
silently converts a draft into a financial event.

**External MCP access.** A Cloudflare Worker (`workers/mcp`, permitted by ADR
0024's second-deployable-runtime clause) serves MCP over streamable HTTP with
`workers-oauth-provider` in front. Connecting a client walks OAuth to the
app's own consent page, where the member signs in with their existing passkey
— no new identity provider — and approving mints a one-time code the worker
exchanges for a 90-day grant token. The worker holds no household logic and no
Supabase credentials: it fetches the tool manifest from the app and relays
calls to `/api/mcp/call` with the grant. The app verifies the grant, mints a
five-minute member-scoped Supabase JWT (`SUPABASE_JWT_SECRET`), and executes
through the same command layer, so RLS and `auth.uid()` checks enforce
authorization exactly as for a browser session. The service-role key stays out
of every runtime. Grant revocation is by rotating `MCP_GRANT_SECRET`;
per-grant revocation is a follow-up.

**Cost and privacy exceptions.** Metered LLM spend (the household's OpenAI
key) and the Cloudflare Workers free tier are accepted as deliberate
exceptions to ADR 0019's "technically unable to create a bill" stance, scoped
to the assistant. Household content sent to the model provider is a knowing
exception to the ADR 0012 privacy posture, accepted by both members for
assistant requests only; nothing else changes about analytics or replay.

## Consequences

Members can do anything the UI allows by asking, in the app or from any
MCP client they have connected, with money movements always behind an
explicit approval. The tool contract cannot drift between surfaces because
only the app defines it. New secrets exist (`OPENAI_API_KEY`,
`TOOL_APPROVAL_SECRET`, `MCP_GRANT_SECRET`, `SUPABASE_JWT_SECRET`,
`MCP_ALLOWED_REDIRECT_ORIGINS`) and all stay server-side. The MCP bridge
routes are public paths that authenticate their own signed bearer grants, per
the "sensitive mutations authenticate as if public" rule. Operating cost is
no longer structurally zero; it is bounded by the household's own API keys
and the Workers free tier.
