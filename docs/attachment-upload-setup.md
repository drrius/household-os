# Private attachment upload setup

Uploads require both the attachment migration and the `household-attachment-upload` Supabase Edge Function. Deploy them together before enabling uploads. This change has not been deployed to production by the implementation task.

The Next API authenticates the session and forwards bounded file bytes using the member's JWT and the public Supabase key. The Edge Function independently validates that JWT with Auth, checks household membership, inspects bytes, derives the object path, and reserves it using the member's permissions. Only then does it use the Supabase-injected service credential for a single immutable Storage upload. Do not add that credential to Vercel or any browser environment.

For an already linked project, deploy through the normal reviewed release process:

```sh
pnpm exec supabase functions deploy household-attachment-upload
```

Keep the gateway's default JWT verification enabled. The function also independently verifies the bearer token with `auth.getUser`, then resolves membership under that identity. It requires Supabase's automatically injected `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. No custom privileged credential is needed. Do not log request headers, tokens, or file bytes. There is no anonymous upload route or client Storage INSERT policy.

For local verification with the local Supabase stack running:

```sh
pnpm db:test
pnpm exec supabase functions serve household-attachment-upload
```

Use a local test member's app session to upload a photo and a PDF receipt; confirm a PDF submitted as a completion with a forged image MIME is rejected, direct authenticated Storage uploads are denied, a lost response retries the same object, and cleanup cannot remove a linked receipt. Unit tests exercise the actual Edge handler with controlled services; pgTAP tests cover denied direct Storage writes and the shared allocation/cleanup lock guard. Browser fixtures cover pending, retry, expiration, replacement, and removal. These controlled checks do not prove hosted deployment or live Storage integration.

If the function is unavailable, uploads fail visibly and can be retried. Never restore authenticated Storage INSERT as a fallback. The Storage INSERT trigger also checks pending registry state under a row lock, including privileged writes, so a cleanup tombstone cannot be resurrected by an in-flight upload.

Authentication follows the current [Supabase Edge Function guidance](https://supabase.com/docs/guides/functions/auth).
