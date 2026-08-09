# Zero-cost hosting review

- Reviewed: 2026-08-09
- Status: Accepted architecture

## Conclusion

Version one will operate with a hard CHF 0 ceiling using Supabase Free and Vercel Hobby. Cloudflare's Next.js support uses the OpenNext adapter; Cloudflare reports broad feature support, but Next.js does not yet list that adapter as verified, so Cloudflare is not part of the selected runtime.

## Recommended runtime

- Next.js App Router on Vercel Hobby for personal, non-commercial use.
- Supabase Free in Frankfurt for Postgres, Auth, Realtime, Storage, Edge Functions, and Cron.
- Supabase's experimental native passkeys provide passwordless authentication without an email provider.

## Free-tier fit

Supabase Free currently includes 500 MB of database storage, 1 GB of file storage, 5 GB of egress, 50,000 monthly active users, 500,000 Edge Function invocations, two million Realtime messages, and 200 peak Realtime connections. These quotas are far beyond the expected two-person workload.

Vercel Hobby permits personal and non-commercial projects and is sufficient for this traffic profile. If the application is later offered commercially, its hosting plan must be revisited.

Cloudflare Workers Free currently includes 100,000 requests per day. Cloudflare R2 Standard includes 10 GB-month of free storage, one million Class A operations, ten million Class B operations, and free egress per month.

## Material caveats

Supabase may pause a Free project after a low-activity seven-day period. A few genuine user database requests per day are typically sufficient, but exclusion from pausing is not guaranteed.

Supabase Free does not provide automatic backups. Version one accepts this limitation and does not operate an independent backup process.

Supabase's built-in email sender is best-effort, limited to two emails per hour, and intended for testing. Version one does not use outbound authentication email; trusted administrator commands generate private enrollment and recovery links.

On iOS, Web Push requires the application to be installed on the Home Screen and notification permission to be requested from a user action. A service worker is required for push handling even though version one does not work offline.

## Sources

- TanStack choice superseded by the accepted Next.js decision.
- https://nextjs.org/docs/app/guides/deploying-to-platforms
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://vercel.com/legal/terms
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/pricing?product=transactional
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
