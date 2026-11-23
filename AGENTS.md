<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Data access uses the browser Supabase client with RLS; admin rights come only from `public.user_roles` via `has_role()` — keeps privilege checks server-enforced.
- Profiles and the default role are created by the `handle_new_user` trigger from signup metadata — the client never inserts profiles directly.
- Kenyan county/sub-county lists live in `src/lib/kenya.ts` and must match the seeded job locations — otherwise users can pick a sub-county with no jobs.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); `/` always redirects to `/auth`.
- Referrals are free: profiles hold `referral_code`/`referred_by`, set by the signup trigger; referrers read their list only via the `my_referrals()` RPC — never expose referred users' contact details.
- User-posted jobs insert as `review_status='pending'`, `is_active=false` (enforced by RLS) and only admins publish them — keeps unvetted listings off job seekers' dashboards.
- Passwords are only ever handled by auth (hashed); forgotten passwords use the email reset flow at `/reset-password` — never store or display readable passwords.
