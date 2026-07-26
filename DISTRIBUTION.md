# Getting it to her

Two separate jobs. The website going live does **not** put the extension in her
Chrome — they are distributed by completely different channels.

| | Where it goes | How long |
| --- | --- | --- |
| The website | GitHub → Vercel → your Hostinger domain | ~30 minutes |
| The extension | Chrome Web Store (unlisted) | **a few days**, mostly waiting on Google |

Read the timing note at the bottom before you promise her anything.

---

## 1 · GitHub

```bash
cd /home/nemesis/ClosetBB
git add -A
git commit -m "Mon Amour"
gh repo create mon-amour --private --source=. --push
```

No `gh`? Create an empty **private** repo on github.com, then:

```bash
git remote add origin https://github.com/<you>/mon-amour.git
git branch -M main
git push -u origin main
```

`.env.local` is gitignored, so your keys stay on your machine. Verified — the
only env file that ships is `.env.example`, which is empty placeholders.

---

## 2 · Vercel

1. <https://vercel.com/new> → import the repo
2. **Environment Variables**, before deploying:

   ```
   NEXT_PUBLIC_SUPABASE_URL        https://qubapjlhruuhqnjkszvb.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   (the anon key from .env.local)
   SUPABASE_SERVICE_ROLE_KEY       (Supabase → Settings → API → service_role)
   CRON_SECRET                     node -e "console.log(crypto.randomUUID())"
   ```

   The last two are only for the price tracker. The site works without them.

3. **Deploy** → you get `https://something.vercel.app`
4. Supabase → **Authentication → URL Configuration**:
   - Site URL: your Vercel URL
   - Redirect URLs: add `https://<your-url>/auth/callback`

Open it and sign in with the password you made her. Empty wardrobe, greeting
first. That's the site done.

---

## 3 · Hostinger domain

Hostinger sells you the name; Vercel keeps running the app. You are only
pointing DNS — do not try to host Next.js on Hostinger shared hosting.

1. **Vercel → your project → Settings → Domains → Add**, enter your domain.
   Vercel shows you the records it wants.
2. **Hostinger → Domains → DNS / Nameservers → Manage DNS records.**
3. Add what Vercel asked for. It is normally:

   | Type | Name | Value |
   | --- | --- | --- |
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   > Use the values on **your** Vercel screen, not these — Vercel changes them
   > occasionally and yours is authoritative.

4. Delete any existing `A` or `CNAME` on `@` and `www` that Hostinger
   pre-filled, or they will fight.
5. Wait. Usually minutes, occasionally hours. Vercel's domain page goes green
   and issues the HTTPS certificate by itself.

**Then update two things:**

- Supabase → Authentication → URL Configuration → Site URL and Redirect URLs →
  your real domain
- `PRODUCTION_APP_URL` in `extension/service-worker.js` (next section)

The `.vercel.app` address keeps working, so nothing breaks in the meantime.

---

## 4 · The extension, on the Chrome Web Store

She cannot install from a folder unless she has the folder. To install the
normal way, it has to be listed. **Unlisted** is what you want: it does not
appear in search, and only people with the link can install it.

### Before you pack

Open `extension/service-worker.js` and set your live address at the top:

```js
const PRODUCTION_APP_URL = "https://monamour.yourdomain.com";
```

This is what makes it work for her with nothing to configure. Then:

```bash
npm run pack:extension
```

It refuses to build if that is still empty — an extension published pointing at
localhost does nothing on anybody else's machine, silently.

You get `dist/mon-amour-extension-v1.0.0.zip`.

### Also worth doing

Add your domain to `host_permissions` in `manifest.json` alongside the shops:

```json
"host_permissions": ["https://monamour.yourdomain.com/*", "*://*.myntra.com/*", ...]
```

Otherwise Chrome prompts her for permission on first use. It still works either
way, it is just one less thing for her to wonder about. Re-pack afterwards.

### Submitting

1. <https://chrome.google.com/webstore/devconsole> — pay the **one-off US$5**
   developer registration
2. **New item** → upload the ZIP
3. Fill the listing:

   - **Name**: Mon Amour — Wardrobe Collector
   - **Summary**: Saves pieces from Myntra, Zara, H&M, Ajio, Nykaa, Urbanic and
     Savana straight into your own Mon Amour wardrobe.
   - **Category**: Shopping
   - **Screenshots**: 1280×800. Two is enough — the popup on a Myntra bag, and
     the wardrobe itself.
   - **Privacy policy URL**: `https://<your-domain>/privacy` — already built and
     deliberately readable while signed out
   - **Visibility**: **Unlisted**

4. **Permission justifications.** Google always asks. Say this:

   | Permission | Why |
   | --- | --- |
   | Shop host access | Reads the product the user just added to their bag, on the seven shops listed. Product details only. |
   | `activeTab`, `scripting` | Lets the user save a piece from a shop we do not have a built-in adapter for, only when they click the extension. |
   | `storage` | Keeps the user's own app address and sign-in token locally. |
   | `alarms` | Re-checks saved prices a few times a day. |
   | `contextMenus` | A right-click "Save to Mon Amour". |
   | `tabs` | Finds the already-open Mon Amour tab to read the session from. |
   | Host access to your domain | The extension's own backend — where saved pieces go. |

   Also tick **"I do not sell or transfer user data to third parties"**, which
   is true.

5. Submit. **Review takes anywhere from a few hours to a couple of weeks.**
   Broad host permissions get looked at by a human, so expect days, not
   minutes.

### Once it is approved

Send her the Web Store link. She clicks **Add to Chrome**, signs in to Mon Amour
once, and that is the whole setup. No folder, no developer mode, no warnings.

---

## 5 · The stopgap: her laptop, before the Store approves

Perfectly reasonable — but the order matters, and getting it wrong produces an
extension that fails silently on her machine.

### Deploy first. Push second.

`PRODUCTION_APP_URL` ships inside the extension. If you push while it is empty,
the copy she downloads hunts for `localhost:3000–3003` **on her own laptop**,
finds nothing, and shows a pink "pointing at localhost:3000" with no wardrobe.
She would have to type the address by hand to rescue it.

So:

1. Deploy to Vercel and get the real URL (§2, §3)
2. Set it in `extension/service-worker.js`:
   ```js
   const PRODUCTION_APP_URL = "https://monamour.yourdomain.com";
   ```
3. Add it to `host_permissions` in `extension/manifest.json` too, so Chrome
   does not prompt her:
   ```json
   "host_permissions": ["https://monamour.yourdomain.com/*", "*://*.myntra.com/*", …]
   ```
4. **Then** commit and push.

### What she does

1. Your repo → green **Code** button → **Download ZIP**
2. Unzip it somewhere permanent — Documents, not Downloads, and it has to stay
   there for as long as she uses the extension
3. `chrome://extensions` → **Developer mode** on, top right
4. **Load unpacked** → select the **`extension`** folder *inside* the unzipped
   folder — not the outer one
5. Open your site, sign in with the password you gave her. Done.

The extension icon should show a green dot and your domain in the popup. If it
does not, the address is in the popup's ⚙.

### If the repo is private

She needs a GitHub account and a collaborator invite before she can download
anything. If you would rather skip that: make the repo public — there are no
secrets in it, verified — or just send her the unzipped folder over WhatsApp or
a drive link. She never needs the repo itself, only `extension/`.

### When the Store version lands

She removes the unpacked one at `chrome://extensions` and installs from the
link. Her wardrobe is untouched — it lives in the database, not the extension.

---

## Timing, honestly

The site can be live tonight. **The extension cannot.** Web Store review is not
something you can hurry, and this one asks for access to seven shopping domains,
which reviewers read carefully.

If you want her using it before review clears, the only options are:

- **She loads it unpacked once**, from a folder, and swaps to the Store version
  when it lands. Ugly, but works today.
- **She waits**, and gets the clean install. Meanwhile the website is fully
  usable on its own — paste a link works today on Myntra, Nykaa, Urbanic and
  most shops.

My suggestion: give her the website now, and let the extension arrive as a
second surprise when Google gets round to it.
