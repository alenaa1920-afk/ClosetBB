# Mon Amour

A luxury personal wardrobe dashboard — one place to keep everything she loves,
gathered from Myntra, Zara, H&M, Ajio, Nykaa, Urbanic, Savana and anywhere else.

Not a shop. Not an admin panel. A private, quiet, beautiful room.

---

## Opening it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

With no environment variables set, Mon Amour opens in **atelier mode**: the
wardrobe lives in the browser and is seeded with a small demo collection, so a
fresh clone looks like itself immediately. Add Supabase keys (below) to move it
to the cloud.

### Scripts

| Script                 | What it does                       |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Development server                 |
| `npm run build`        | Production build                   |
| `npm start`            | Serve the production build         |
| `npm run typecheck`    | `tsc --noEmit`, strict             |
| `npm run lint`         | ESLint                             |
| `npm run format`       | Prettier, write                    |
| `npm run format:check` | Prettier, check only               |
| `npm run verify`       | typecheck → lint → build, in order |

---

## The greeting

Every single visit opens on a full-screen greeting before the dashboard:
**Bonjour ❤️ Madame**, the words fading in one at a time, the heart pulsing
slowly, a very subtle field of pink petals drifting behind. After three seconds
it lifts away like a veil. There is deliberately no skip button.

The heart is drawn (a filled Lucide `Heart` in `--primary`) rather than the ❤️
emoji, because the brief asks for a **pink** heart and the emoji renders red on
every platform. Everything else about the phrase is exactly as specified — it
lives in one place, `components/welcome/welcome-gate.tsx`, if you ever want the
comma variant.

---

## Setting up Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run `supabase/migrations/0001_init.sql`. It is
   re-runnable, so it is safe to paste again after edits.
3. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

4. In **Authentication → URL Configuration**, add the redirect URL
   `http://localhost:3000/auth/callback` (and your production equivalent).
5. Restart `npm run dev`. Sign in with a magic link at `/login`.

### What the migration creates

`users`, `stores`, `products`, `collections`, `collection_products`,
`favorites`, `price_history`, plus:

- **Row-level security on everything.** Every policy is scoped to
  `auth.uid()`, so the wardrobe is private even though the anon key is public.
- **A price-history trigger.** Inserting a product records its opening price;
  changing the price appends a new row. That is what drives the green
  _Price dropped!_ badge and the sparkline in the detail sheet.
- **`products_expanded`** — a `security_invoker` view returning each product
  with its favourite flag, collection ids and full price history, so opening the
  wardrobe is one round trip.
- **A `product-images` storage bucket**, with write access limited to each
  person's own folder.

Regenerate types after schema changes:

```bash
supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
```

> The checked-in `database.types.ts` is hand-maintained so the repo type-checks
> without a database. Keep its members as `type` aliases, not `interface` —
> interfaces get no implicit index signature and silently fail Supabase's
> `GenericSchema` constraint, which degrades every query to `never`.

---

## How things get in

There is no sample data. The wardrobe starts empty, on purpose — a fabricated
dress with a fabricated price sitting in her closet would be a lie.

### Which route works for which shop

Measured against the live sites, not assumed:

| Shop | Paste a link | Extension |
| --- | --- | --- |
| **Myntra** | ✅ title, price, photo | ✅ cart adapter |
| **Nykaa** | ✅ | ✅ cart adapter |
| **Urbanic** | ✅ | ✅ cart adapter |
| **Savana** | ✅ | ✅ cart adapter |
| **Zara** | ❌ renders in JS, ships no metadata | ✅ cart adapter |
| **H&M** | ❌ answers `403` to any server | ✅ cart adapter |
| **Ajio** | ❌ answers `403` to any server | ✅ cart adapter |
| Anywhere else | usually, via OpenGraph/JSON-LD | generic fallback |

This is why the extension is the primary route rather than a convenience: it
reads the page from inside her browser, where bot protection and JS rendering
stop mattering. `serverFetch` in `lib/domain/stores.ts` records the measurement,
and the add sheet uses it to say *"Zara builds its pages in JavaScript — use the
extension"* the moment such a link is pasted, instead of failing vaguely.

**Paste a link.** `POST /api/unfurl` fetches the page server-side and reads
OpenGraph, JSON-LD (including `@graph` nesting) and microdata for title, brand,
image, price, original price, currency, colour and size. The store is recognised
from the hostname and the category guessed from the words. Every field stays
editable in the add sheet.

The endpoint fetches a URL the client chose, so it is guarded: http/https only,
a 9-second timeout, a 2 MB read cap, redirects followed by hand with the guard
re-run on every hop, and refusal of localhost, `.local`, `.internal`, and any
address that resolves into private space — including the IPv4-mapped and NAT64
spellings of it, which `URL` re-spells into hex. There is a per-IP rate limit.

**The Chrome extension.** Opening a cart files it automatically. See below.

**By hand.** The same sheet, with nothing prefilled.

### What is kept

Title, brand, store, category, price, original price, discount, currency,
photograph, product link, **the size she chose**, every size the shop offered,
colour, **quantity in her bag**, seller, rating and rating count, product code,
availability, a private note from you, favourite, collections, and the full
price history.

---

## Chrome extension

Manifest V3, in `extension/`.

**To put this live for someone else, follow [SETUP.md](./SETUP.md)** — it covers
the Supabase project, the Vercel deploy and installing the extension on her
laptop, step by step.

For local use:

1. Visit `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → choose the `extension/` folder.
3. Open the popup's ⚙ and set the Mon Amour address if it is not
   `http://localhost:3000`. Chrome will ask permission for it.
4. Sign in to Mon Amour in a normal tab.
5. Open a cart on any supported shop. **It files itself** — the toolbar icon
   shows a count, then a ✓. Elsewhere: right-click → **Save to Mon Amour**, or
   open the popup and press the button. Auto-save is on by default and can be
   turned off in the popup's ⚙.

It authenticates by asking the app for the current access token
(`/api/extension/session`, authorised by the ordinary session cookie) and posts
to `/api/extension/products` as a bearer token, so row-level security applies
and the extension can only ever write to its own wardrobe. Products are
upserted on `(user_id, product_url)`, so re-saving a cart refreshes prices
instead of duplicating pieces — which is what feeds price history.

### Adding a store

One entry in `extension/content/adapters.js`. Each adapter tries three
strategies in order:

1. **structured** — JSON-LD. Survives redesigns.
2. **selectors** — attribute-contains CSS hints (`[class*="itemContainer"]`),
   which survive the hashed class names these sites generate.
3. **heuristic** — find repeated blocks holding one image and a price.

All seven shops ship adapters; every other site falls back to structured data
plus the heuristic, which is usually enough for a single product page.

---

## Price tracking

**Instant price tracking does not exist**, in this or any product — no shop
pushes out a notification when a price moves. Every price watcher, Honey and
Keepa included, re-reads the page on a schedule. Mon Amour does the same, by two
routes, because one is not enough:

- **`/api/track`** — the project's only cron job, once a day at 03:00 UTC,
  which is what Vercel's Hobby plan allows. It re-reads the shops that answer a
  server (Myntra, Nykaa, Urbanic, Savana and most others), walking the twenty
  pieces whose price has gone longest unchecked and always stamping
  `last_checked_at` so one stubborn page cannot stall the queue.
- **The extension**, on a `chrome.alarms` timer every six hours, re-reads Zara,
  H&M and Ajio from inside her browser — the only place those shops will answer
  — and posts what it found to `/api/extension/prices`. This one only runs while
  Chrome is open.

Either way the database trigger turns a changed figure into a `price_history`
row, which is what draws the green **Price dropped!** badge and the sparkline.
Freshness is hours, not seconds, which is the right granularity for clothes.
Each piece has its own switch in its detail sheet.

> Cart markup on these sites changes without notice, and the selector hints
> here were written from their class-naming patterns rather than verified
> against a live logged-in cart. If a cart stops yielding items, update that
> store's `selectors` block — the heuristic keeps working meanwhile, and the
> popup tells you which strategy produced the results.

---

## Deploying to Vercel

1. Push the repo and import it at <https://vercel.com/new>.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Add `https://<your-domain>/auth/callback` to Supabase's redirect URLs.
4. Add `https://<your-domain>/*` to the extension's `host_permissions`, or set
   the address in the popup and accept the permission prompt.

---

## Shape of the code

```
app/                    routes only — thin
  api/unfurl/           link reading
  api/extension/        session + product intake for the extension
  auth/callback/        magic-link landing
  login/  settings/
components/
  ui/                   buttons, dropdown, sheet, badges, heart, loader, confetti
  welcome/              the greeting and its petals
features/               one folder per feature, composed by the dashboard
  add-product/  auth/  collections/  dashboard/
  filters/  navigation/  settings/  wardrobe/
lib/
  domain/               entities and pure logic — no React, no I/O
  data/                 repository interface + Supabase and local adapters
  store/                Zustand: wardrobe, theme, settings
  server/               server-only (the unfurl fetcher and parser)
  supabase/             clients and generated-shape types
supabase/migrations/    the schema
extension/              Manifest V3 collector
```

Two rules hold it together:

- **`lib/domain` is pure.** Filtering, sorting, discounts, price drops and
  categorisation are ordinary functions over plain data, so they are easy to
  reason about and to test.
- **Storage sits behind one interface.** `WardrobeRepository` has two
  implementations — Supabase and the local atelier — and nothing above the data
  layer knows which is live.

---

## Notes on the details

**Motion.** Nothing appears instantly. Cards fade, scale and lift in on scroll
with a stagger that stops after the first screenful; buttons answer on a spring;
dropdowns expand from their own top edge; sheets rise and blur in, and can be
dragged away on a phone. The loader is tiny hearts lifting one after another —
there is no spinner anywhere. All of it collapses politely under
`prefers-reduced-motion`.

**Dark mode.** A second full token set — deep plum-charcoal, the same pink and
gold — applied by a class on `<html>` written before first paint by a blocking
inline script, so it never flashes. Zara's badge swaps to a light colour there,
since near-black disappears on a dark ground.

**Performance.** Route-level code splitting, `next/image` with AVIF/WebP and
lazy loading below the fold, memoised cards, derived state behind `useMemo`, and
a masonry that mounts in chunks of 60 with an `IntersectionObserver` a screen
and a half ahead — so a wardrobe of thousands opens as fast as one of twelve.
This is incremental windowing rather than true virtualisation: rows already
scrolled past stay mounted. If the wardrobe ever reaches the tens of thousands,
that is the thing to replace.

**Images.** `next.config.ts` allows any https host, because the whole point is
that a link from a boutique nobody anticipated still shows its photograph. SVG
is not trusted through the optimiser; the demo plates in `public/atelier` are
served unoptimised because they are ours.

**A private note.** Each piece can carry one line from you, shown only in its
detail sheet. It was not in the final spec — it is one field, `products.note`,
and it comes out cleanly if you would rather it were not there.

---

## What is verified, and what is not

**A correction worth recording.** An earlier draft of this file said the unfurl
endpoint "reads OpenGraph, JSON-LD and microdata" and left it there. That was
true of the code and misleading about the outcome: I had not checked whether
these particular shops hand any of it over, and three of the seven don't. The
table above is measured. Two real bugs also came out of testing rather than
review — `₹1,299` parsed as `1.3`, and a public URL redirecting to an internal
address slipped past the SSRF guard. Both are fixed and covered.


Checked: `npm run verify` passes clean — strict `tsc`, ESLint with zero
warnings, production build. All routes render. The unfurl guards were exercised
against hostile URLs (localhost, loopback, cloud metadata, every private IPv4
range, IPv6 loopback/link-local/unique-local/multicast, IPv4-mapped and NAT64
spellings, `file:` and `ftp:` schemes, malformed input) — all refused. The
parser was run against Myntra-style JSON-LD, OG-only and `@graph`-nested
fixtures, and the price reader against seventeen real-world price spellings,
including the Indian grouping (`₹1,299`, `₹12,34,567`) that a naive parser gets
wrong.

Also checked: all seven store adapters resolve their own cart URLs; the
extension's DOM-free price reader against seven markup shapes; the store-aware
error hints against live Zara, H&M and Ajio pages (each names the shop and
points at the extension); and every new endpoint refusing an unauthenticated
caller.

Not verified, and you should treat these as the real tests:

- **The migrations have never run against a live Supabase project.** They are
  the most likely thing to need a fix on first contact.
- **The extension has never been loaded into a real Chrome** against a
  logged-in cart. The cart selector hints come from each site's class-naming
  patterns, not from inspecting a live cart, so expect one round of adjustment —
  the popup names which strategy it used to make that easy.
- **Auto-save and the price alarm have not run in a real browser session.**
- The 401 paths on the extension endpoints could only be tested as 503 locally,
  since there are no Supabase keys here.
# ClosetBB
