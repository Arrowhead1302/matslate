# MatSlate — setup checklist

## 1. Create the database (one time)
1. Supabase → your `matslate` project → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it in, and click **Run**.
   You should see "Success. No rows returned."

## 2. Login settings in Supabase (one time)
**Authentication → URL Configuration**
- Site URL: `https://matslate.com`
- Redirect URLs: add `https://matslate.com/**` and `http://localhost:5173/**`

**Authentication → Emails → Templates → Magic Link** — replace the message body with:

```html
<h2>Sign in to MatSlate</h2>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#F26B3A;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:18px">Sign in</a></p>
<p>Or type this code on the sign-in page: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
<p style="color:#666">If you didn't ask to sign in, you can ignore this email.</p>
```
Paste the same body into the **Confirm signup** template too. Subject for both: `Your MatSlate sign-in link`.

## 3. Publish the website (one time)
1. GitHub Desktop → commit → **Publish repository** (uncheck "Keep this code private" — GitHub Pages is free for public repos; nothing secret is in this code).
2. On github.com → the `matslate` repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder: **/docs** → Save.
3. Same page → **Custom domain**: `matslate.com` → Save. Tick **Enforce HTTPS** once it's available.
4. At your domain registrar, add these DNS records:
   - `A` record, host `@` → `185.199.108.153`
   - `A` record, host `@` → `185.199.109.153`
   - `A` record, host `@` → `185.199.110.153`
   - `A` record, host `@` → `185.199.111.153`
   - `CNAME` record, host `www` → `YOUR-GITHUB-USERNAME.github.io`
   (Leave the Microsoft 365 MX/TXT records alone.)

## 4. Make yourself the admin (one time)
1. Go to matslate.com, sign in with your email, and fill in the setup form (pick your school, Head Coach).
2. Supabase → SQL Editor → run (with your email):
   ```sql
   update profiles set is_admin = true where email = 'you@example.com';
   ```
3. Refresh MatSlate. You'll see an **Admin** tab — approve yourself there.

## Every update after that
Claude rebuilds the `docs` folder with each change. Commit in GitHub Desktop and click **Push origin** —
the live site updates in a minute or two.

## Notes
- Until custom email (Resend) is set up, Supabase only sends a few sign-in emails per hour — fine for testing, not for launch.
- Free Supabase projects pause after 7 days with no activity (mostly an off-season risk). Optional fix, done once on github.com:
  repo → **Add file → Create new file** → name it `.github/workflows/keep-awake.yml` → paste the block below → **Commit changes**.

```yaml
name: Keep database awake
on:
  schedule:
    - cron: '17 15 */3 * *'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -s -o /dev/null "https://qvzdlptzurpfcwatijda.supabase.co/rest/v1/regions?select=id&limit=1" -H "apikey: sb_publishable_SABaj74I6uCCk0nqXgWOPQ_uoz7Mq4A"
```
