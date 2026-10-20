# Deploying Shoptet Canvas

Runs on a personal Cloudflare account, free plan. Do the steps in order; each one ends with a check.
Rough time: 45 minutes the first time.

Already done in code: board data and images are pinned to Cloudflare's **EU** region, and preview
URLs are off (they would bypass the login from step 5).

---

## Step 1 — Commit your work

```bash
git status            # nothing should be left uncommitted
git add -A && git commit -m "…"
```

✅ `git status` says "nothing to commit".

## Step 2 — Cloudflare account + login

1. Sign up at https://dash.cloudflare.com/sign-up (free plan) and verify your email.
2. In the project folder:

```bash
npx wrangler login     # opens the browser, click "Allow"
npx wrangler whoami    # shows your account name + ID
```

✅ `whoami` prints your email and account.

## Step 3 — Create the image bucket (EU)

1. Dashboard → **R2 Object Storage** → enable R2 if asked. Cloudflare may want a card on file;
   usage stays inside the free tier (10 GB).
2. Then:

```bash
npx wrangler r2 bucket create shoptet-canvas-uploads --jurisdiction eu
```

✅ `npx wrangler r2 bucket list --jurisdiction eu` shows `shoptet-canvas-uploads`.

## Step 4 — First deploy

```bash
npm run deploy
```

The first time, Wrangler asks you to pick a `workers.dev` subdomain (e.g. `borecky`). At the end it
prints the URL, e.g. `https://shoptet-canvas.borecky.workers.dev`.

✅ Open the URL, create a board, open the same board in a second window, and check that a sticky shows
up in both. Add an image too.

⚠️ Until step 5 is done, anyone with the URL can open it. Do step 5 straight away and don't share the link before.

## Step 5 — Put a login in front (Cloudflare Access)

1. Dashboard → **Workers & Pages** → `shoptet-canvas` → **Settings** → **Domains & Routes**.
2. Next to the `workers.dev` URL, click **Enable Cloudflare Access**. If this is your first time,
   Cloudflare asks you to create a Zero Trust "team name" and pick the **Free** plan (up to 50 users).
3. Click **Manage Cloudflare Access** → edit the policy:
   - Action: **Allow**
   - Include: **Emails ending in** → `@team.blue` (add other company domains if needed)
4. Login method: **One-time PIN** is on by default. People type their work email and get a code.
   No company SSO setup needed.

✅ Open the URL in a private window: you should get a Cloudflare login page. Your `@team.blue` email
gets a code and lets you in. A personal email (e.g. Gmail) gets no code.

## Step 6 — Invite the team

Share the URL. Everyone logs in with their work email once (the session lasts 24 hours by default;
adjustable in the Access application settings).

✅ A colleague can open a board you send them and you see each other's cursors.

---

## Day-to-day

- **Ship a change:** `npm run deploy`
- **Undo a bad deploy:** `npx wrangler rollback`. This rolls back code only; board data is untouched.
- **Logs:** Dashboard → Workers & Pages → shoptet-canvas → **Logs**, or `npx wrangler tail`

## Later (not needed to start)

- [ ] Nightly board backups to R2
- [ ] Validate the Access login token inside the Worker too (defence in depth; Cloudflare recommends it)
- [ ] Custom domain (needs a domain on this Cloudflare account)
- [ ] Auto-deploy on push via GitHub Actions
- [ ] Before going wider: consider moving to a company Cloudflare account
      (boards live in the account that created them; moving them later means an export/import)

## Don't change after the first real boards exist

- `jurisdiction` (EU) in `worker/worker.ts` and `wrangler.toml`
- The Durable Object name/binding (`Board` / `BoardServer`) and existing `[[migrations]]` tags
- The worker `name` in `wrangler.toml`

Changing any of these points the app to new, empty storage.
