# Mon Amour — Wardrobe Collector

A Manifest V3 extension that lifts a whole cart into her Mon Amour wardrobe.

## Installing

1. `chrome://extensions` → **Developer mode** on.
2. **Load unpacked** → this `extension/` folder.
3. Open the popup, press ⚙, and set the address where Mon Amour is running if
   it is not `http://localhost:3000`. Chrome asks permission for that origin.
4. Sign in to Mon Amour in a normal tab.
5. Open a cart on Myntra or Savana and press **Save to Mon Amour**.

## How it fits together

```
manifest.json          permissions, popup, content-script matches
service-worker.js      the only thing that talks to the app
content/adapters.js    the store registry — add boutiques here
content/collect.js     answers the popup with what the page holds
popup/                 preview, selection, and saving
```

`service-worker.js` asks the app for the current access token via
`/api/extension/session` (authorised by the ordinary session cookie), then posts
to `/api/extension/products` with `Authorization: Bearer …`. Row-level security
still applies, so the extension can only write to the signed-in person's own
wardrobe. Fetching from the worker means the extension's host permission
applies and the app needs no CORS headers.

## Adding a store

Append one entry to `ADAPTERS` in `content/adapters.js`:

```js
{
  key: "ajio",                       // must match lib/domain/stores.ts
  label: "Ajio",
  hosts: [/(^|\.)ajio\.com$/],
  isBagPage: (url) => /\/(cart|bag)/.test(url.pathname),
  selectors: {
    item: ['[class*="cart-item"]'],  // first selector that matches wins
    brand: ['[class*="brand"]'],
    title: ['[class*="name"]', "h3"],
    price: ['[class*="price"]'],
    originalPrice: ["s", "del"],
    size: ['[class*="size"]'],
    color: ['[class*="color"]'],
  },
}
```

Then add the host to `content_scripts.matches` in `manifest.json` so the script
loads without needing `activeTab` injection.

Three strategies run in order, and the popup shows which one produced the list:

| Strategy       | Source                                      | Robustness |
| -------------- | ------------------------------------------- | ---------- |
| `structured`   | JSON-LD `Product`                           | High       |
| `selectors`    | the `selectors` block above                 | Medium     |
| `heuristic`    | blocks holding one image and a price         | Low        |

Prefer attribute-contains selectors (`[class*="itemName"]`) over exact class
names: these sites append build hashes, so `.itemName-base-x7f2a` becomes
`.itemName-base-b91cc` on the next deploy.

## When a cart reads empty

1. Scroll the cart once so every row has loaded, then **Scan again** — rows are
   lazy-mounted.
2. If the popup says _best guess_ or finds nothing, the store's `selectors`
   block needs updating. Inspect a cart row, find a stable class fragment, and
   add it to the front of the relevant array.
3. The selector hints shipped here follow each site's documented class-naming
   patterns but have not been verified against a live logged-in cart, so expect
   to adjust them once.
