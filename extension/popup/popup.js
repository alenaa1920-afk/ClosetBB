/**
 * Mon Amour — popup
 *
 * Asks the page what it is holding, shows a preview, and hands the chosen
 * pieces to the service worker to save.
 */

const el = {
  context: document.getElementById("context"),
  loader: document.getElementById("loader"),
  notice: document.getElementById("notice"),
  results: document.getElementById("results"),
  list: document.getElementById("list"),
  count: document.getElementById("results-count"),
  strategy: document.getElementById("strategy"),
  selectAll: document.getElementById("select-all"),
  save: document.getElementById("save"),
  rescan: document.getElementById("rescan"),
  settings: document.getElementById("settings"),
  settingsToggle: document.getElementById("settings-toggle"),
  appUrl: document.getElementById("app-url"),
  saveUrl: document.getElementById("save-url"),
  watchNow: document.getElementById("watch-now"),
  watchStatus: document.getElementById("watch-status"),
  autoSave: document.getElementById("auto-save"),
  connected: document.getElementById("connected"),
};

let found = [];
let status = null;

/* ------------------------------------------------------------------ *
 *  Plumbing
 * ------------------------------------------------------------------ */

function ask(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply ?? { ok: false, error: "No reply from the extension." });
    });
  });
}

function askTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply ?? { ok: false, error: "The page did not answer." });
    });
  });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function money(value, currency) {
  if (value == null) return "—";
  const symbol = currency === "INR" || !currency ? "₹" : `${currency} `;
  return symbol + Number(value).toLocaleString("en-IN");
}

function show(node, visible) {
  node.hidden = !visible;
}

function notice(html, tone) {
  el.notice.className = `panel notice${tone ? ` ${tone}` : ""}`;
  el.notice.innerHTML = html;
  show(el.notice, true);
}

/* ------------------------------------------------------------------ *
 *  Rendering
 * ------------------------------------------------------------------ */

function render() {
  el.list.replaceChildren();

  found.forEach((product, index) => {
    const item = document.createElement("li");
    item.className = "item";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = product.selected;
    check.setAttribute("aria-label", `Include ${product.title}`);
    check.addEventListener("change", () => {
      found[index].selected = check.checked;
      syncFooter();
    });

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.alt = "";
    if (product.imageUrl) thumb.src = product.imageUrl;

    const text = document.createElement("div");
    text.className = "item-text";

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = product.title;

    const meta = document.createElement("p");
    meta.className = "item-meta";
    meta.textContent = money(product.price, product.currency);
    if (product.originalPrice) {
      const was = document.createElement("s");
      was.textContent = money(product.originalPrice, product.currency);
      meta.appendChild(was);
    }

    text.append(title, meta);
    item.append(check, thumb, text);
    el.list.appendChild(item);
  });

  syncFooter();
  show(el.results, found.length > 0);
}

function syncFooter() {
  const chosen = found.filter((product) => product.selected);
  el.count.textContent = found.length === 1 ? "1 piece" : `${found.length} pieces`;
  el.save.disabled = chosen.length === 0 || !status?.signedIn;
  el.save.textContent = chosen.length
    ? `Save ${chosen.length} to Mon Amour`
    : "Save to Mon Amour";
  el.selectAll.checked = chosen.length === found.length && found.length > 0;
}

/* ------------------------------------------------------------------ *
 *  Flow
 * ------------------------------------------------------------------ */

async function scan() {
  show(el.loader, true);
  show(el.results, false);
  show(el.notice, false);
  found = [];

  const tab = await activeTab();
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    show(el.loader, false);
    el.context.textContent = "No shop open";
    notice(
      "Open a cart or a product page on a shopping site, then try again.",
      "warn",
    );
    return;
  }

  el.context.textContent = new URL(tab.url).hostname.replace(/^www\./, "");

  let reply = await askTab(tab.id, { type: "MON_AMOUR_COLLECT" });

  // Not a site the manifest covers — inject on demand via activeTab.
  if (!reply.ok) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/adapters.js", "content/collect.js"],
      });
      reply = await askTab(tab.id, { type: "MON_AMOUR_COLLECT" });
    } catch (error) {
      show(el.loader, false);
      notice(`This page cannot be read: ${String(error.message ?? error)}`, "warn");
      return;
    }
  }

  show(el.loader, false);

  if (!reply.ok) {
    notice(`Could not read the page: ${reply.error}`, "warn");
    return;
  }

  el.context.textContent = reply.isBagPage ? `${reply.label} — cart` : reply.label;
  el.strategy.textContent =
    reply.strategy === "selectors"
      ? "cart"
      : reply.strategy === "structured"
        ? "product page"
        : reply.strategy === "heuristic"
          ? "best guess"
          : "";

  found = (reply.products ?? [])
    .filter((product) => product.title)
    .map((product) => ({ ...product, selected: true }));

  if (!found.length) {
    notice(
      "Nothing recognisable on this page. On a cart page, scroll once so every row loads, then scan again.",
      "warn",
    );
    return;
  }

  render();
}

async function refreshStatus() {
  status = await ask({ type: "STATUS" });
  el.appUrl.value = status.appUrl ?? "";
  // Always visible, so a wrong address can never hide behind a status code.
  el.connected.textContent = status.appUrl
    ? `${status.identified ? "connected to" : "pointing at"} ${status.appUrl.replace(/^https?:\/\//, "")}`
    : "";
  el.connected.className = status.identified ? "conn ok" : "conn bad";

  if (!status.granted) {
    notice(
      `Mon Amour needs permission for <strong>${status.appUrl}</strong>. Open settings above and confirm the address.`,
      "warn",
    );
    show(el.settings, true);
  } else if (!status.identified) {
    // Almost always a wrong port, with something else answering on it.
    notice(
      `${status.error ?? "That address is not Mon Amour."}<br><br>` +
        `Set the correct address below — it is whatever <code>npm run dev</code> printed.`,
      "warn",
    );
    show(el.settings, true);
  } else if (!status.signedIn) {
    notice(
      `${status.error ?? "Not signed in."} <button class="link" id="open-app">Open Mon Amour</button>`,
      "warn",
    );
    document.getElementById("open-app")?.addEventListener("click", () => {
      chrome.tabs.create({ url: `${status.appUrl}/login` });
    });
  }

  syncFooter();
}

async function save() {
  const chosen = found
    .filter((product) => product.selected)
    .map(({ selected: _selected, ...product }) => product);

  el.save.disabled = true;
  el.save.textContent = "Saving…";

  const reply = await ask({ type: "SAVE", products: chosen });

  if (!reply.ok) {
    notice(reply.error, "warn");
    el.save.textContent = "Save to Mon Amour";
    syncFooter();
    return;
  }

  const saved = reply.saved ?? chosen.length;
  notice(
    `${saved === 1 ? "One piece" : `${saved} pieces`} saved to her wardrobe. ♥`,
    "good",
  );
  el.save.textContent = "Saved";
  show(el.results, false);
  found = [];
}

/* ------------------------------------------------------------------ *
 *  Wiring
 * ------------------------------------------------------------------ */

el.selectAll.addEventListener("change", () => {
  const next = el.selectAll.checked;
  found = found.map((product) => ({ ...product, selected: next }));
  render();
});

el.rescan.addEventListener("click", () => void scan());
el.save.addEventListener("click", () => void save());

el.settingsToggle.addEventListener("click", () => {
  show(el.settings, el.settings.hidden);
});

el.autoSave.addEventListener("change", async () => {
  await ask({ type: "SET_AUTO_SAVE", enabled: el.autoSave.checked });
});

el.watchNow.addEventListener("click", async () => {
  el.watchNow.disabled = true;
  el.watchStatus.textContent = "Reading prices…";

  const reply = await ask({ type: "WATCH_NOW" });
  el.watchNow.disabled = false;

  if (!reply.ok) {
    el.watchStatus.textContent = reply.error;
    return;
  }
  if (reply.skipped === "signed-out") {
    el.watchStatus.textContent = "Sign in to Mon Amour first.";
    return;
  }
  if (!reply.checked) {
    el.watchStatus.textContent = "Nothing waiting to be checked.";
    return;
  }
  el.watchStatus.textContent =
    reply.drops > 0
      ? `Checked ${reply.checked} — ${reply.drops} dropped in price.`
      : `Checked ${reply.checked}. No changes.`;
});

el.saveUrl.addEventListener("click", async () => {
  const reply = await ask({ type: "SET_APP_URL", url: el.appUrl.value });
  if (!reply.ok) {
    notice(reply.error, "warn");
    return;
  }
  show(el.settings, false);
  await refreshStatus();
  await scan();
});

(async function start() {
  const auto = await ask({ type: "GET_AUTO_SAVE" });
  el.autoSave.checked = auto.ok ? Boolean(auto.autoSave) : true;

  await refreshStatus();
  await scan();
})();
