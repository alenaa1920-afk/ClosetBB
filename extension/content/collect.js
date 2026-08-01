/**
 * Content script bridge.
 *
 * Answers the popup on request, and — so that saving feels like nothing at all
 * — announces itself whenever a cart page settles, letting the worker put a
 * count on the toolbar icon and (if she has it on) save without being asked.
 */

(function () {
  "use strict";

  /**
   * The collector can now arrive by four routes: the declared content script,
   * the everywhere script registered at runtime, the worker adopting an open
   * tab, and the popup injecting on demand. Running twice would attach two
   * click listeners and save the same piece twice, so the first one in wins.
   */
  if (self.__monAmourCollector) return;
  self.__monAmourCollector = true;

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "MON_AMOUR_COLLECT") return false;

    try {
      const result = self.MonAmourAdapters.collect();
      respond({ ok: true, ...result, pageUrl: location.href });
    } catch (error) {
      respond({ ok: false, error: String(error?.message ?? error) });
    }
    return false;
  });

  /* ---------------------------------------------------------------- *
   *  Announcing a cart
   * ---------------------------------------------------------------- */

  let lastSignature = "";

  function announce() {
    let result;
    try {
      result = self.MonAmourAdapters.collect();
    } catch {
      return;
    }
    if (!result || !result.products.length) return;

    // Only speak up when the contents actually changed.
    const signature = `${result.products.length}:${result.products
      .map((product) => `${product.title}@${product.price}`)
      .join("|")}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    chrome.runtime.sendMessage(
      {
        type: "PAGE_ITEMS",
        pageUrl: location.href,
        isBagPage: result.isBagPage,
        strategy: result.strategy,
        store: result.store,
        products: result.products,
      },
      // The worker may be asleep; a missing reply is not an error.
      () => void chrome.runtime.lastError,
    );
  }

  /* ---------------------------------------------------------------- *
   *  "Add to bag" — the moment that actually matters
   *
   *  Waiting for her to open the cart is one step too many. We watch for the
   *  press itself and file the piece there and then, with the size she just
   *  chose. The cart-page sweep below stays as a backstop for anything added
   *  before the extension was installed.
   * ---------------------------------------------------------------- */

  const ADD_RE =
    /\b(add to (bag|cart|basket)|add item|move to bag|buy now|añadir|ajouter)\b/i;

  /** Walk up a few levels: the click usually lands on a span inside a button. */
  function addToCartControl(target) {
    let node = target instanceof Element ? target : null;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const label = [
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("data-testid"),
        node.getAttribute?.("title"),
        node.className && typeof node.className === "string" ? node.className : "",
        // Only the button's own text, not a whole panel's worth.
        node.textContent && node.textContent.length < 60 ? node.textContent : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (ADD_RE.test(label)) return node;
      if (/add[-_]?to[-_]?(bag|cart)/i.test(label)) return node;
    }
    return null;
  }

  let lastAddAt = 0;

  function onAddToCart() {
    /**
     * Only long enough to swallow a double-click and the capture/bubble pair.
     *
     * It used to be three seconds, which broke the common flow: pressing "Add
     * to bag" without a size opens the size picker, and the *real* press a
     * moment later landed inside the window and was thrown away. Genuine
     * duplicates are caught by the worker's signature cooldown instead, which
     * keys on the piece rather than on the clock.
     */
    const now = Date.now();
    if (now - lastAddAt < 800) return;
    lastAddAt = now;

    /**
     * Read the page straight away rather than waiting a fixed beat.
     *
     * Everything we need — name, price, the size she just chose — is already
     * in the DOM at the moment she presses the button; the old 900ms pause was
     * insurance against slow sites and it made every save feel sluggish. Now
     * we try immediately and only fall back to waiting if the first look came
     * up empty, so the common case is instant and the awkward case still works.
     */
    const attempts = [0, 400, 1100];

    const tryCollect = (index) => {
      let product = null;
      try {
        product = self.MonAmourAdapters.collectCurrent();
      } catch {
        product = null;
      }

      if (product?.title) {
        chrome.runtime.sendMessage(
          { type: "ADD_TO_CART", pageUrl: location.href, product },
          () => void chrome.runtime.lastError,
        );
        return;
      }

      const next = index + 1;
      if (next < attempts.length) {
        setTimeout(() => tryCollect(next), attempts[next] - attempts[index]);
      }
    };

    tryCollect(0);
  }

  document.addEventListener(
    "click",
    (event) => {
      if (addToCartControl(event.target)) onAddToCart();
    },
    // Capture, so we still see it if the site stops propagation.
    { capture: true, passive: true },
  );

  /** Carts render in stages, so wait for the DOM to go quiet. */
  let settleTimer = null;
  function scheduleAnnounce(delay = 900) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(announce, delay);
  }

  scheduleAnnounce(1200);

  const observer = new MutationObserver(() => scheduleAnnounce());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // These sites are single-page apps: navigation does not reload the script.
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function patched(...args) {
      const result = original.apply(this, args);
      lastSignature = "";
      scheduleAnnounce(1200);
      return result;
    };
  }
  window.addEventListener("popstate", () => {
    lastSignature = "";
    scheduleAnnounce(1200);
  });
})();
