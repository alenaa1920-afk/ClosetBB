/**
 * Mon Amour — background service worker
 *
 * Owns everything that talks to the app: reading the session token from the
 * signed-in tab's cookies, and posting collected pieces to the wardrobe.
 * Fetches happen here so the extension's host permissions apply and no CORS
 * headers are needed on the app side.
 */

importScripts("price-reader.js");

/* ------------------------------------------------------------------ *
 *  ↓↓↓  SET THIS BEFORE PACKING FOR THE CHROME WEB STORE  ↓↓↓
 *
 *  Put your live address here so the extension works the moment she
 *  installs it, with nothing to configure. Leave the trailing slash off.
 *
 *      const PRODUCTION_APP_URL = "https://monamour.example.com";
 *
 *  Leave it empty during local development.
 * ------------------------------------------------------------------ */
const PRODUCTION_APP_URL = "";

const DEFAULT_APP_URL = PRODUCTION_APP_URL || "http://localhost:3000";
const TOKEN_KEY = "monAmourToken";

/** How often we re-read prices for the shops the server cannot reach. */
const WATCH_ALARM = "monAmourPriceWatch";
const WATCH_PERIOD_MINUTES = 360;
/** Kept small: this runs on her machine and her bandwidth. */
const WATCH_BATCH = 8;

/* ------------------------------------------------------------------ *
 *  Settings
 * ------------------------------------------------------------------ */

/** Ports a dev server lands on when the one before it is taken. */
const LOCAL_CANDIDATES = [3000, 3001, 3002, 3003].map(
  (port) => `http://localhost:${port}`,
);

/**
 * Does a Mon Amour actually live here?
 *
 * Worth asking, because something else may be sitting on the port — this
 * machine runs Open WebUI on 3000, which cheerfully answers every request and
 * returns 405 for anything it does not recognise. Without this check the
 * extension posts her wardrobe into the void.
 */
async function probeApp(origin) {
  try {
    const response = await fetch(`${origin}/api/extension/products`, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.app === "mon-amour";
  } catch {
    return false;
  }
}

async function appUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return (appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
}

/**
 * Finds the app without being told. Checks the stored address first, then the
 * handful of ports a local dev server uses. Only ever settles on something
 * that identifies itself as Mon Amour.
 */
async function detectAppUrl() {
  const stored = (await chrome.storage.sync.get("appUrl")).appUrl;
  if (stored && (await probeApp(stored))) return stored;

  // Production first — that is where she is, and it is the common case.
  const candidates = [
    ...(PRODUCTION_APP_URL ? [PRODUCTION_APP_URL] : []),
    ...LOCAL_CANDIDATES,
  ];
  for (const candidate of candidates) {
    if (await probeApp(candidate)) {
      await chrome.storage.sync.set({ appUrl: candidate });
      return candidate;
    }
  }
  return stored || DEFAULT_APP_URL;
}

/**
 * Chrome match patterns cannot carry a port — `http://localhost:3001/*` is
 * rejected outright — so a permission pattern is scheme + host only. It
 * therefore covers every port on that host, which is what we want for
 * localhost anyway.
 */
function matchPatternFor(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

async function hasHostAccess(origin) {
  try {
    return await chrome.permissions.contains({
      origins: [matchPatternFor(origin)],
    });
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 *  Session
 * ------------------------------------------------------------------ */

/**
 * The session lives in `storage.local`, not `storage.session`, so it survives
 * Chrome restarts — she signs in once and never again.
 *
 * It is put there by `content/session-bridge.js`, because the Supabase cookie
 * is SameSite=Lax and will not travel on a fetch the worker starts itself.
 * Once we hold the refresh token we no longer need the cookie for anything.
 */
async function storedSession() {
  const store = await chrome.storage.local.get(TOKEN_KEY);
  return store[TOKEN_KEY] ?? null;
}

function isFresh(entry) {
  if (!entry?.accessToken) return false;
  // Anything inside a minute of expiry counts as already stale.
  return !entry.expiresAt || entry.expiresAt * 1000 > Date.now() + 60_000;
}

/** Accepts a session handed over by the page. */
async function rememberSession(session) {
  if (!session?.accessToken) return { stored: false };
  const previous = (await storedSession()) ?? {};
  const entry = {
    accessToken: session.accessToken,
    // A refresh token is only issued sometimes; never overwrite a good one
    // with nothing.
    refreshToken: session.refreshToken ?? previous.refreshToken ?? null,
    expiresAt: session.expiresAt ?? null,
    email: session.email ?? previous.email ?? null,
    supabaseUrl: session.supabaseUrl ?? previous.supabaseUrl ?? null,
    supabaseAnonKey: session.supabaseAnonKey ?? previous.supabaseAnonKey ?? null,
  };
  await chrome.storage.local.set({ [TOKEN_KEY]: entry });
  return { stored: true, email: entry.email };
}

/** Mints a new access token straight from Supabase, no app tab required. */
async function refreshSession(entry) {
  if (!entry?.refreshToken || !entry.supabaseUrl || !entry.supabaseAnonKey) {
    return null;
  }

  let response;
  try {
    response = await fetch(
      `${entry.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: entry.supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token: entry.refreshToken }),
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!payload?.access_token) return null;

  const next = {
    ...entry,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? entry.refreshToken,
    expiresAt:
      payload.expires_at ??
      Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600),
  };
  await chrome.storage.local.set({ [TOKEN_KEY]: next });
  return next;
}

/** Asks any open Mon Amour tab to hand its session over again. */
async function askTabsForSession() {
  const base = await appUrl();
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: `${new URL(base).origin}/*` });
  } catch {
    return null;
  }

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/session-bridge.js"],
      });
      // The bridge messages us; give it a moment, then re-read.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const entry = await storedSession();
      if (isFresh(entry)) return entry;
    } catch {
      // Tab closed, or we lack permission for it.
    }
  }
  return null;
}

async function token({ force = false } = {}) {
  let entry = await storedSession();

  if (!force && isFresh(entry)) return entry;

  // Renew ourselves first — this is the path that works with nothing open.
  const refreshed = await refreshSession(entry);
  if (refreshed) return refreshed;

  const fromTab = await askTabsForSession();
  if (fromTab) return fromTab;

  const base = await appUrl();
  throw new Error(`Open ${base} and sign in, then try again.`);
}

/* ------------------------------------------------------------------ *
 *  Saving
 * ------------------------------------------------------------------ */

async function save(products) {
  const base = await detectAppUrl();
  const session = await token();

  const post = (accessToken) =>
    fetch(`${base}/api/extension/products`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ products }),
    });

  let response = await post(session.accessToken);

  // A stale token gets exactly one retry with a fresh one.
  if (response.status === 401) {
    const refreshed = await token({ force: true });
    response = await post(refreshed.accessToken);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Name the endpoint: a bare status code sends you hunting.
    throw new Error(
      payload.error ||
        `POST ${base}/api/extension/products answered ${response.status}. ` +
          `If that looks wrong, reload the extension at chrome://extensions.`,
    );
  }
  return payload;
}

/* ------------------------------------------------------------------ *
 *  Seamless capture
 *
 *  A cart page announces itself; we badge the icon with the count and, when
 *  auto-save is on, file it without her having to ask. Saving the same cart
 *  twice is harmless — the app upserts on the product link, so a repeat visit
 *  refreshes prices rather than duplicating pieces.
 * ------------------------------------------------------------------ */

const AUTO_SAVE_DEFAULT = true;
/** Don't re-save the same cart contents more often than this. */
const AUTO_SAVE_COOLDOWN_MS = 10 * 60 * 1000;

async function autoSaveEnabled() {
  const { autoSave } = await chrome.storage.sync.get("autoSave");
  return autoSave === undefined ? AUTO_SAVE_DEFAULT : Boolean(autoSave);
}

async function badge(tabId, count) {
  if (tabId == null) return;
  try {
    await chrome.action.setBadgeText({
      tabId,
      text: count > 0 ? String(Math.min(count, 99)) : "",
    });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#EC4899" });
  } catch {
    // The tab closed mid-flight.
  }
}

async function onPageItems(message, sender) {
  const tabId = sender?.tab?.id;
  const products = Array.isArray(message.products) ? message.products : [];
  await badge(tabId, products.length);

  if (!message.isBagPage || !products.length) return { saved: 0 };
  if (!(await autoSaveEnabled())) return { saved: 0 };

  // One save per distinct cart, per cooldown.
  const signature = `${message.pageUrl}#${products.length}#${products
    .map((product) => `${product.title}@${product.price}`)
    .join("|")}`;
  const { autoSaveLog = {} } = await chrome.storage.session.get("autoSaveLog");
  const now = Date.now();
  if (
    autoSaveLog[signature] &&
    now - autoSaveLog[signature] < AUTO_SAVE_COOLDOWN_MS
  ) {
    return { saved: 0, skipped: "cooldown" };
  }

  try {
    const result = await save(products);
    autoSaveLog[signature] = now;

    // Keep the log from growing without bound.
    for (const [key, at] of Object.entries(autoSaveLog)) {
      if (now - at > AUTO_SAVE_COOLDOWN_MS * 6) delete autoSaveLog[key];
    }
    await chrome.storage.session.set({ autoSaveLog });

    if (tabId != null) {
      await chrome.action.setBadgeText({ tabId, text: "✓" });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#15926B" });
    }
    return result;
  } catch (error) {
    // Silent: she did not ask for this, so a failure must not interrupt her.
    // The popup will show the real reason when she opens it.
    console.warn("[mon amour] auto-save skipped:", error.message);
    return { saved: 0, error: error.message };
  }
}

/**
 * She pressed "Add to bag". File it now, with the size she just chose —
 * she should never have to open the cart, let alone press anything of ours.
 */
async function onAddToCart(message, sender) {
  const tabId = sender?.tab?.id;
  const product = message?.product;
  if (!product?.title) return { saved: 0 };
  if (!(await autoSaveEnabled())) return { saved: 0, skipped: "auto-save-off" };

  const signature = `add:${product.productUrl || product.title}:${product.size ?? ""}`;
  const { autoSaveLog = {} } = await chrome.storage.session.get("autoSaveLog");
  const now = Date.now();
  if (
    autoSaveLog[signature] &&
    now - autoSaveLog[signature] < AUTO_SAVE_COOLDOWN_MS
  ) {
    return { saved: 0, skipped: "cooldown" };
  }

  try {
    const result = await save([product]);
    autoSaveLog[signature] = now;
    await chrome.storage.session.set({ autoSaveLog });

    if (tabId != null) {
      await chrome.action.setBadgeText({ tabId, text: "♥" });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#15926B" });
      // Let the tick fade rather than sit there forever.
      setTimeout(() => {
        void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
      }, 6000);
    }
    return result;
  } catch (error) {
    console.warn("[mon amour] add-to-cart save failed:", error.message);
    if (tabId != null) {
      await chrome.action.setBadgeText({ tabId, text: "!" });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#E6C46A" });
    }
    return { saved: 0, error: error.message };
  }
}

/* ------------------------------------------------------------------ *
 *  Price watching
 *
 *  Zara, H&M and Ajio refuse a server-side fetch, so the app's cron cannot
 *  see their prices. From here we can: the request carries her cookies and
 *  comes from a residential address, so the shops answer normally.
 * ------------------------------------------------------------------ */

async function watchPrices() {
  const base = await appUrl();

  let session;
  try {
    session = await token();
  } catch {
    // Not signed in — nothing to do until she is.
    return { checked: 0, skipped: "signed-out" };
  }

  const listed = await fetch(`${base}/api/extension/prices?limit=${WATCH_BATCH}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  if (!listed.ok) return { checked: 0, skipped: `list-${listed.status}` };

  const { products = [] } = await listed.json();
  if (!products.length) return { checked: 0 };

  const observations = [];
  for (const product of products) {
    if (!product.productUrl) continue;
    try {
      const page = await fetch(product.productUrl, {
        credentials: "omit",
        cache: "no-store",
      });
      if (!page.ok) continue;
      const html = await page.text();
      const { price, availability } = self.MA_PRICE.read(html);
      // Record the visit even when the page hid its price, so the queue moves.
      observations.push({ id: product.id, price, availability });
    } catch {
      // A single unreachable shop must not abandon the rest of the batch.
    }
  }

  if (!observations.length) return { checked: 0 };

  const posted = await fetch(`${base}/api/extension/prices`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ observations }),
  });
  if (!posted.ok) return { checked: 0, skipped: `post-${posted.status}` };

  const result = await posted.json().catch(() => ({}));
  await chrome.storage.local.set({
    lastWatch: { at: Date.now(), ...result },
  });
  return { checked: observations.length, ...result };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCH_ALARM) void watchPrices();
});

async function ensureAlarm() {
  const existing = await chrome.alarms.get(WATCH_ALARM);
  if (!existing) {
    await chrome.alarms.create(WATCH_ALARM, {
      periodInMinutes: WATCH_PERIOD_MINUTES,
      delayInMinutes: 3,
    });
  }
}

/**
 * The session bridge ships statically for localhost only — the production
 * address is whatever she typed, so it is registered at runtime.
 */
const BRIDGE_ID = "monAmourSessionBridge";

async function registerSessionBridge(origin) {
  const pattern = matchPatternFor(origin);
  if (pattern.startsWith("http://localhost")) return; // already in the manifest

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [BRIDGE_ID],
    });
    if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [BRIDGE_ID] });
    }
  } catch {
    // Nothing registered yet.
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: BRIDGE_ID,
        matches: [pattern],
        js: ["content/session-bridge.js"],
        runAt: "document_idle",
      },
    ]);
  } catch (error) {
    console.warn("[mon amour] could not register session bridge:", error.message);
  }
}

async function onWake() {
  await ensureAlarm();
  await registerSessionBridge(await appUrl());
}

chrome.runtime.onInstalled.addListener(() => void onWake());
chrome.runtime.onStartup.addListener(() => void onWake());

/* ------------------------------------------------------------------ *
 *  Messages from the popup
 * ------------------------------------------------------------------ */

const HANDLERS = {
  async STATUS() {
    // Re-detect each time: the dev port moves, and a wrong address is the
    // single most confusing failure this thing has.
    const base = await detectAppUrl();
    const origin = new URL(base).origin;
    const granted = await hasHostAccess(origin);

    if (!granted) {
      return { appUrl: base, granted: false, identified: false, signedIn: false };
    }

    const identified = await probeApp(base);
    if (!identified) {
      return {
        appUrl: base,
        granted: true,
        identified: false,
        signedIn: false,
        error: `Nothing at ${base} identifies itself as Mon Amour. Check the address below.`,
      };
    }

    try {
      const session = await token();
      return {
        appUrl: base,
        granted: true,
        identified: true,
        signedIn: true,
        email: session.email,
      };
    } catch (error) {
      return {
        appUrl: base,
        granted: true,
        identified: true,
        signedIn: false,
        error: String(error.message ?? error),
      };
    }
  },

  async SAVE({ products }) {
    if (!Array.isArray(products) || !products.length) {
      throw new Error("Nothing selected.");
    }
    return save(products);
  },

  async WATCH_NOW() {
    return watchPrices();
  },

  async SESSION({ session }) {
    return rememberSession(session);
  },

  async GET_AUTO_SAVE() {
    return { autoSave: await autoSaveEnabled() };
  },

  async SET_AUTO_SAVE({ enabled }) {
    await chrome.storage.sync.set({ autoSave: Boolean(enabled) });
    return { autoSave: Boolean(enabled) };
  },

  async SET_APP_URL({ url }) {
    const trimmed = String(url || "")
      .trim()
      .replace(/\/+$/, "");
    const parsed = new URL(trimmed); // throws on nonsense
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Use an http or https address.");
    }

    const granted = await chrome.permissions.request({
      origins: [matchPatternFor(parsed.origin)],
    });
    if (!granted) throw new Error("Permission for that address was declined.");

    // Refuse to point at something that is not Mon Amour, rather than saving
    // the address and failing mysteriously later.
    if (!(await probeApp(parsed.origin))) {
      throw new Error(
        `${parsed.origin} did not answer as Mon Amour. Is the app running there?`,
      );
    }

    await chrome.storage.sync.set({ appUrl: parsed.origin });
    await chrome.storage.local.remove(TOKEN_KEY);
    // The bridge only ships statically for localhost; register it for whatever
    // address she just pointed us at.
    await registerSessionBridge(parsed.origin);
    return { appUrl: parsed.origin };
  },
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "ADD_TO_CART") {
    onAddToCart(message, sender)
      .then((result) => respond({ ok: true, ...result }))
      .catch((error) =>
        respond({ ok: false, error: String(error.message ?? error) }),
      );
    return true;
  }

  // A cart announcing itself; this one needs to know which tab it came from.
  if (message?.type === "PAGE_ITEMS") {
    onPageItems(message, sender)
      .then((result) => respond({ ok: true, ...result }))
      .catch((error) =>
        respond({ ok: false, error: String(error.message ?? error) }),
      );
    return true;
  }

  const handler = HANDLERS[message?.type];
  if (!handler) return false;

  handler(message)
    .then((result) => respond({ ok: true, ...result }))
    .catch((error) =>
      respond({ ok: false, error: String(error.message ?? error) }),
    );

  // Keeps the channel open for the async reply.
  return true;
});

/* ------------------------------------------------------------------ *
 *  Right-click anywhere on a shop
 * ------------------------------------------------------------------ */

const MENU_ID = "monAmourSave";

function installMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Save to Mon Amour",
      contexts: ["page", "selection", "image", "link"],
    });
  });
}

chrome.runtime.onInstalled.addListener(installMenu);
chrome.runtime.onStartup.addListener(installMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  try {
    const reply = await chrome.tabs.sendMessage(tab.id, {
      type: "MON_AMOUR_COLLECT",
    });
    if (!reply?.ok || !reply.products?.length) return;

    await save(reply.products);
    await chrome.action.setBadgeText({ tabId: tab.id, text: "✓" });
    await chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: "#15926B",
    });
  } catch (error) {
    console.warn("[mon amour] context save failed:", error.message);
  }
});
