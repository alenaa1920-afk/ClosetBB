# Putting Mon Amour live

Everything here needs your own accounts, so these are the steps only you can
run. All of it is free.

When you're done: she opens a URL, sees **Bonjour ❤️ Madame**, and her wardrobe
fills itself as she shops.

---

## Short on time? Do it in this order

You do **not** need to deploy to test the extension. It talks to whatever
address you point it at, including your laptop.

| | Step | Time | Needed for |
| --- | --- | --- | --- |
| 1 | Supabase project + both migrations + keys | ~10 min | everything — the extension has nowhere to save without it |
| 2 | `npm run dev`, load the extension, test a real cart | ~10 min | **testing it yourself in Chrome** |
| 3 | Deploy to Vercel | ~15 min | her using it on her own laptop |
| 4 | Price tracker keys (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) | ~5 min | optional, can come later |

Stop after 2 if you only want to see it working. Everything after that is about
getting it onto her machine.

### A note about ports

Something on this machine is already using port 3000 (Open WebUI), so
`npm run dev` starts on **3001**. That's fine — the extension's ⚙ lets you set
the address, and it now accepts localhost on any port. Either:

- point the extension at `http://localhost:3001`, or
- stop the other service and run `npm run dev -- -p 3000`.

---

## 1 · Supabase (the wardrobe itself)

1. Go to <https://supabase.com> → **New project**.
   - Name it whatever you like; pick the region closest to you
     (`ap-south-1 · Mumbai` if you're in India).
   - Save the database password somewhere — you won't need it for this, but
     you'll want it later.
2. Wait for it to finish provisioning (~2 minutes).
3. Open the file **`supabase/RUN_THIS_IN_SUPABASE.sql`** in your editor, select
   all of it (`Ctrl+A`), and copy (`Ctrl+C`).

   > Paste the **contents** of the file, not its name. The SQL editor runs SQL;
   > a filename is just text it doesn't understand.

4. In Supabase: **SQL Editor** → **New query** → paste → **Run**.

   You want `Success. No rows returned`. It is safe to run again if you need to.
5. Go to **Project Settings → API** and copy three things:

   | Copy this            | You'll paste it as              |
   | -------------------- | ------------------------------- |
   | Project URL          | `NEXT_PUBLIC_SUPABASE_URL`      |
   | `anon` `public` key  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `service_role` key   | `SUPABASE_SERVICE_ROLE_KEY`     |

   > The `service_role` key bypasses row-level security. It is only ever used
   > by the scheduled price tracker on the server. Never put it in a
   > `NEXT_PUBLIC_` variable and never commit it.

### Create her account — do this, don't rely on email

Mon Amour accepts a password *or* a magic link. Use a password: it is instant,
it cannot be rate-limited, and she signs in exactly once.

1. **Authentication → Users → Add user → Create new user**
2. Enter her email and a password you choose
3. **Tick "Auto Confirm User".**

   > This one matters. Without it Supabase marks the account unconfirmed and
   > waits for her to click a verification email — which is the whole thing you
   > are avoiding. She will not be able to sign in.

4. **Create user.**

Do the same for yourself, so you can test without touching her account.

She types that email and password once. The session is stored in a cookie that
lasts 400 days and renews itself every visit, so she will not see a login screen
again. Magic links stay available underneath as a forgotten-password path — no
setup needed, they just work when the mailer isn't rate-limited.

---

## 2 · Test it on your own machine first

Do this before deploying. If something's wrong you want to find it here, where
the fix is instant.

1. Put your two Supabase values into `.env.local` (the file already exists with
   the names in it), then:

   ```bash
   npm run dev
   ```

2. Open the address it prints (`http://localhost:3001` here) and sign in.
3. `chrome://extensions` → **Developer mode** on → **Load unpacked** →
   pick the `extension/` folder.
4. Click the Mon Amour icon → ⚙ → type `http://localhost:3001` →
   **Use this address** → accept Chrome's permission prompt.
5. Go to Myntra, put something in your bag, open the bag.

You should see a pink count appear on the extension icon, then a green ✓.
Reload Mon Amour and it's there — photograph, price, size, quantity.

If the icon stays blank, open the popup: it will tell you what happened. If it
found items but says *best guess*, that store's selectors need a nudge
(`extension/README.md`).

---

## 3 · Vercel (the site)

You need the code on GitHub first:

```bash
cd /home/nemesis/ClosetBB
git init
git add -A
git commit -m "Mon Amour"
gh repo create mon-amour --private --source=. --push
```

Then:

1. <https://vercel.com/new> → import the repo.
2. Before deploying, open **Environment Variables** and add all four:

   ```
   NEXT_PUBLIC_SUPABASE_URL        https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY       eyJhbG...
   CRON_SECRET                     <any long random string>
   ```

   For the last one: `node -e "console.log(crypto.randomUUID())"`.

3. **Deploy.** You'll get a URL like `https://mon-amour.vercel.app`.
4. Go back to Supabase → **Authentication → URL Configuration** and set:
   - **Site URL**: `https://mon-amour.vercel.app`
   - **Redirect URLs**: add `https://mon-amour.vercel.app/auth/callback`

   Sign-in links will fail until you do this.

5. Open the URL. You should get the greeting, then an empty wardrobe.

Want a nicer address? **Settings → Domains** in Vercel. A domain is about
₹800/year and makes it feel like a real gift rather than a project.

### The price tracker

There is exactly **one** cron job: `/api/track`, scheduled `0 3 * * *` — once a
day at 03:00 UTC (08:30 IST). That fits inside Vercel's Hobby limits.

If you ever move to Pro and want it more often, change the schedule in
`vercel.json`; `0 */6 * * *` gives four runs a day. Nothing else needs touching
— the endpoint is idempotent and picks up wherever it left off.

Check it works after deploying:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/track
```

---

## 4 · The extension, on her laptop

The extension isn't on the Chrome Web Store, so it loads unpacked. That's
free and takes two minutes, but it lives in a folder that has to stay put.

1. Send her the `extension/` folder (zip it, or share the repo).
   She should put it somewhere permanent — **not** Downloads.
2. She opens `chrome://extensions`, turns on **Developer mode** (top right).
3. **Load unpacked** → selects the `extension/` folder.
4. She clicks the Mon Amour icon → the ⚙ → types your live URL
   (`https://mon-amour.vercel.app`) → **Use this address**. Chrome will ask
   permission for that site; accept.
5. She opens the site in a tab and signs in.
6. Done. From now on:
   - **Opening a cart on Myntra, Zara, H&M, Ajio, Nykaa, Urbanic or Savana
     files it automatically** — the icon shows a count, then a ✓.
   - Any other shop: right-click → **Save to Mon Amour**, or open the popup and
     press the button.
   - Auto-save can be switched off in the popup's ⚙ if she'd rather choose.

### Two things worth telling her

- Chrome shows *"Disable developer mode extensions"* every few restarts. She can
  dismiss it; the extension keeps working. Publishing to the Web Store (US$5
  one-off, a few days' review) is the only way to remove that nag.
- Re-opening a cart re-saves it. That's deliberate — it's how prices stay
  current and how the price history builds up. Nothing duplicates.

---

## 5 · Check it end to end

1. On her laptop, sign in to the live site.
2. Add something to a Myntra cart, then open the cart.
3. The extension icon shows a count, then ✓.
4. Reload Mon Amour — it's there, with photograph, price, size and quantity.
5. Open it and you'll see the price-history chart begin.

If a cart shows nothing: scroll it once so every row loads, then open the popup
and press **Scan again**. The popup tells you which strategy it used — if it
says *best guess*, that store's selectors need a nudge (see
`extension/README.md`).

---

## What this costs

| | |
| --- | --- |
| Supabase free tier | 500 MB database, 1 GB files — thousands of pieces |
| Vercel Hobby | free for personal use; the one cron job runs daily |
| Domain (optional) | ~₹800/year |

Supabase pauses a free project after a week of no activity. Opening the site
wakes it, but the first load after that is slow. If she uses it weekly it never
sleeps.

---

## About "real-time" price tracking

There is no such thing, in any product — not Honey, not Keepa. No shop pushes
out a notification when a price changes; the only way to know is to look again.
What Mon Amour does is look again on a schedule:

- **Myntra, Nykaa, Urbanic, Savana and most shops** — the server re-reads them
  once a day, on the single Vercel cron job.
- **Zara, H&M and Ajio** — these answer `403` to any server, so the extension
  re-reads them from her browser every six hours instead, where they answer
  normally. This only happens while Chrome is open.

Either way she sees a green **Price dropped!** badge on the card and the drop
plotted in the piece's history. Freshness is hours, not seconds — which is the
right granularity for clothes.
