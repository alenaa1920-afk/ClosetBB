/**
 * Mon Amour — store adapters
 *
 * Adding a boutique means adding one entry to ADAPTERS. Each adapter tries the
 * most reliable source first and falls back:
 *
 *   1. structured()  — JSON-LD / page state. Survives redesigns.
 *   2. selectors     — attribute-contains CSS hints, which survive the hashed
 *                      class names these sites generate.
 *   3. heuristic     — find repeated blocks holding an image and a price.
 *
 * Cart markup changes often. If a site stops yielding items, update its
 * `selectors` block; the heuristic keeps working in the meantime.
 */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- *
   *  Shared helpers
   * ---------------------------------------------------------------- */

  const PRICE_RE =
    /(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]{2,}(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/i;

  /**
   * Turns a cleaned digits-and-separators string into a number. The trailing
   * separator decides: three digits after it is thousands grouping ("1,299"),
   * one or two is a decimal point ("4,990.00"). Mirrors the server parser.
   */
  function normaliseNumber(input) {
    const cleaned = String(input)
      .replace(/[^\d.,]/g, "")
      .replace(/^[.,]+/, "")
      .replace(/[.,]+$/, "");
    if (!/\d/.test(cleaned)) return null;

    const lastSeparator = Math.max(
      cleaned.lastIndexOf(","),
      cleaned.lastIndexOf("."),
    );
    let normalised;

    if (lastSeparator === -1) {
      normalised = cleaned;
    } else {
      const digitsAfter = cleaned.length - lastSeparator - 1;
      const separator = cleaned[lastSeparator];
      const separatorCount = cleaned.split(separator).length - 1;
      const groupedThroughout = /^\d{1,3}([.,]\d{3})+$/.test(cleaned);

      if (digitsAfter === 3 && (separatorCount > 1 || groupedThroughout)) {
        normalised = cleaned.replace(/[.,]/g, "");
      } else if (digitsAfter === 1 || digitsAfter === 2) {
        const whole = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "");
        normalised = `${whole}.${cleaned.slice(lastSeparator + 1)}`;
      } else {
        normalised = cleaned.replace(/[.,]/g, "");
      }
    }

    const value = Number.parseFloat(normalised);
    return Number.isFinite(value) && value > 0
      ? Math.round(value * 100) / 100
      : null;
  }

  function parseMoney(input) {
    if (input == null) return null;
    if (typeof input === "number") {
      return Number.isFinite(input) && input > 0 ? input : null;
    }

    const text = String(input);
    const match = PRICE_RE.exec(text);
    return normaliseNumber(match ? (match[1] ?? match[2]) : text);
  }

  /** Every price-looking number in a block, in document order. */
  function allPrices(text) {
    const found = [];
    const pattern = /(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d{1,2})?)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = normaliseNumber(match[1]);
      if (value !== null) found.push(value);
    }
    return found;
  }

  function clean(text) {
    return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  }

  function absolute(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.href);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  /** Lazy-loaded imagery hides in several places. */
  function imageFrom(root) {
    const img = root.querySelector("img");
    if (img) {
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
      if (srcset) {
        const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
        const resolved = absolute(first);
        if (resolved) return resolved;
      }
      for (const attribute of ["src", "data-src", "data-original", "data-lazy"]) {
        const value = img.getAttribute(attribute);
        if (value && !value.startsWith("data:")) {
          const resolved = absolute(value);
          if (resolved) return resolved;
        }
      }
    }

    // Some carts paint the photograph as a background image.
    const painted = root.querySelector('[style*="background-image"]');
    if (painted) {
      const match = /url\(["']?(.+?)["']?\)/.exec(
        painted.getAttribute("style") || "",
      );
      if (match) return absolute(match[1]);
    }
    return null;
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const text = clean(node?.textContent);
      if (text) return text;
    }
    return "";
  }

  /* ---------------------------------------------------------------- *
   *  Detail extraction — size, quantity, stock and the rest
   * ---------------------------------------------------------------- */

  const QTY_RE = /\b(?:qty|quantity)\b\s*[:\-]?\s*(\d{1,2})\b/i;
  const SIZE_RE =
    /\bsizes?\b\s*[:\-]?\s*([a-z0-9]{1,4}(?:\s?\/\s?[a-z0-9]{1,4})?)\b/i;
  const RATING_RE = /\b([0-5](?:\.\d)?)\s*(?:\/\s*5|★|stars?\b|out of 5)/i;
  const RATING_COUNT_RE = /([\d][\d,.]*)\s*(?:k\b)?\s*(?:ratings?|reviews?)/i;

  /** A `<select>` in a cart row is almost always size or quantity. */
  function selectedOption(root, hint) {
    for (const select of root.querySelectorAll("select")) {
      const context = (
        select.getAttribute("name") +
        " " +
        select.getAttribute("aria-label") +
        " " +
        select.className
      ).toLowerCase();
      if (!context.includes(hint)) continue;
      const option = select.options?.[select.selectedIndex];
      const value = clean(option?.textContent) || select.value;
      if (value) return value;
    }
    return "";
  }

  function readSize(root, selectors) {
    const direct = firstText(root, selectors.size ?? []);
    if (direct) {
      // "Size: M" and "Size M, Qty 1" both reduce to "M".
      const match = SIZE_RE.exec(direct);
      if (match) return match[1].trim().toUpperCase();
      if (direct.length <= 8) return direct.toUpperCase();
    }
    const chosen = selectedOption(root, "size");
    if (chosen) return chosen.trim().toUpperCase();

    const match = SIZE_RE.exec(clean(root.textContent));
    return match ? match[1].trim().toUpperCase() : null;
  }

  function readQuantity(root) {
    const chosen = selectedOption(root, "quant") || selectedOption(root, "qty");
    if (chosen) {
      const value = Number.parseInt(chosen.replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(value) && value > 0) return Math.min(value, 99);
    }
    const match = QTY_RE.exec(clean(root.textContent));
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > 0) return Math.min(value, 99);
    }
    return null;
  }

  /** Every size the page offered, from a size picker. */
  function readSizesAvailable(root) {
    const selectorHints = [
      '[class*="size-button"]',
      '[class*="sizeButton"]',
      '[class*="size-option"]',
      '[class*="sizeOption"]',
      '[class*="size-selector"] button',
      '[class*="size-list"] li',
      '[data-testid*="size"] button',
    ];
    for (const selector of selectorHints) {
      const found = [...root.querySelectorAll(selector)]
        .map((node) => clean(node.textContent))
        .filter((text) => text && text.length <= 10);
      if (found.length >= 2) return [...new Set(found)];
    }

    for (const select of root.querySelectorAll("select")) {
      const context = (
        select.getAttribute("name") +
        " " +
        select.className
      ).toLowerCase();
      if (!context.includes("size")) continue;
      const found = [...select.options]
        .map((option) => clean(option.textContent))
        .filter((text) => text && text.length <= 10 && !/select/i.test(text));
      if (found.length >= 2) return [...new Set(found)];
    }
    return [];
  }

  /**
   * The size she has actually chosen on a product page — the highlighted chip
   * in the picker, not the list of what exists.
   */
  function readSelectedSize(root) {
    const hints = [
      '[class*="size"] [class*="selected"]',
      '[class*="size"] [class*="active"]',
      '[class*="size-button"][aria-checked="true"]',
      '[class*="size"] [aria-checked="true"]',
      '[class*="size"] [aria-pressed="true"]',
      '[class*="sizeButton"][class*="Selected"]',
      '[data-testid*="size"] [aria-checked="true"]',
    ];
    for (const selector of hints) {
      const node = root.querySelector(selector);
      const text = clean(node?.textContent);
      if (text && text.length <= 10) return text.toUpperCase();
    }

    const checked = root.querySelector(
      'input[type="radio"][name*="size" i]:checked',
    );
    if (checked) {
      const label =
        root.querySelector(`label[for="${checked.id}"]`) ??
        checked.closest("label");
      const text = clean(label?.textContent) || checked.value;
      if (text && text.length <= 10) return text.toUpperCase();
    }

    const chosen = selectedOption(root, "size");
    return chosen ? chosen.trim().toUpperCase() : null;
  }

  function readAvailability(root) {
    const text = clean(root.textContent).toLowerCase();
    if (/\b(out of stock|sold out|unavailable|not available)\b/.test(text)) {
      return "out_of_stock";
    }
    if (
      /\b(only \d+ left|few (?:pieces )?left|hurry|last \d+|almost gone|low stock)\b/.test(
        text,
      )
    ) {
      return "low_stock";
    }
    return null;
  }

  function readRating(root) {
    const text = clean(root.textContent);
    const match = RATING_RE.exec(text);
    if (!match) return { rating: null, ratingCount: null };

    const rating = Number.parseFloat(match[1]);
    let ratingCount = null;
    const countMatch = RATING_COUNT_RE.exec(text);
    if (countMatch) {
      const raw = countMatch[1].replace(/,/g, "");
      let value = Number.parseFloat(raw);
      if (/k\s*(?:ratings?|reviews?)/i.test(countMatch[0])) value *= 1000;
      if (Number.isFinite(value) && value > 0) ratingCount = Math.round(value);
    }
    return {
      rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : null,
      ratingCount,
    };
  }

  /** The shop's own product code, usually sitting in the URL. */
  function readSku(root, url) {
    const labelled = firstText(root, [
      '[class*="sku"]',
      '[class*="styleId"]',
      '[class*="product-code"]',
      '[class*="productCode"]',
    ]);
    if (labelled) {
      const digits = /([a-z0-9-]{4,})/i.exec(labelled);
      if (digits) return digits[1];
    }
    if (url) {
      const match =
        /\/(?:p|product|dp)?\/?(\d{5,})/.exec(url) || /(\d{6,})/.exec(url);
      if (match) return match[1];
    }
    return null;
  }

  function productHref(root) {
    const anchors = [...root.querySelectorAll("a[href]")];
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      if (/\/(p|product|products|dp|buy)\//i.test(href) || /\d{4,}/.test(href)) {
        return absolute(href);
      }
    }
    return absolute(anchors[0]?.getAttribute("href"));
  }

  /* ---------------------------------------------------------------- *
   *  JSON-LD (works on most single product pages)
   * ---------------------------------------------------------------- */

  function jsonLdBlocks() {
    return [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => {
        try {
          return JSON.parse(node.textContent || "");
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  function findProductNode(node, depth = 0) {
    if (depth > 8 || !node || typeof node !== "object") return null;

    if (Array.isArray(node)) {
      for (const entry of node) {
        const found = findProductNode(entry, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const types = []
      .concat(node["@type"] ?? [])
      .filter((t) => typeof t === "string")
      .map((t) => t.toLowerCase());
    if (types.includes("product")) return node;

    for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant"]) {
      if (key in node) {
        const found = findProductNode(node[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function firstString(value) {
    if (typeof value === "string") return clean(value) || null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = firstString(entry);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === "object") {
      for (const key of ["name", "url", "contentUrl", "@id", "value"]) {
        if (key in value) {
          const found = firstString(value[key]);
          if (found) return found;
        }
      }
    }
    return null;
  }

  /**
   * Like `firstString`, but for fields that must yield a URL.
   *
   * `name` is deliberately absent. Shopify and others ship images as
   * `{ "@type": "ImageObject", "name": "...", "url": "..." }`, and a
   * generic walk picks the name — which then resolves against the page as a
   * link that is not an image, and every photograph silently vanishes.
   */
  function firstUrlString(value) {
    if (typeof value === "string") return clean(value) || null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = firstUrlString(entry);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === "object") {
      for (const key of ["url", "contentUrl", "src", "@id"]) {
        if (key in value) {
          const found = firstUrlString(value[key]);
          if (found) return found;
        }
      }
    }
    return null;
  }
  function offersOf(product) {
    const raw = product.offers;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (raw && typeof raw === "object") {
      return Array.isArray(raw.offers) ? [raw, ...raw.offers] : [raw];
    }
    return [];
  }

  /** A single product page, read from structured data. */
  function collectFromJsonLd(storeKey) {
    for (const block of jsonLdBlocks()) {
      const product = findProductNode(block);
      if (!product) continue;

      const offers = offersOf(product);
      const price =
        parseMoney(offers.map((o) => o?.price).find((v) => v != null)) ??
        parseMoney(offers.map((o) => o?.lowPrice).find((v) => v != null));
      const highPrice = parseMoney(
        offers.map((o) => o?.highPrice).find((v) => v != null),
      );
      const title = firstString(product.name);
      if (!title) continue;

      const currency =
        offers.map((o) => o?.priceCurrency).find((v) => typeof v === "string") ||
        "INR";

      return [
        {
          title,
          brand: firstString(product.brand),
          store: storeKey,
          price,
          originalPrice: highPrice && price && highPrice > price ? highPrice : null,
          currency: String(currency).toUpperCase(),
          imageUrl:
            absolute(firstUrlString(product.image)) ??
            absolute(
              document
                .querySelector('meta[property="og:image"]')
                ?.getAttribute("content"),
            ),
          productUrl: absolute(firstString(product.url)) || location.href,
          color: firstString(product.color),
          size: firstString(product.size),
          // A product page lists its sizes in the picker, not in JSON-LD.
          sizesAvailable: readSizesAvailable(document.body),
          sku:
            firstString(product.sku) ??
            firstString(product.mpn) ??
            readSku(document.body, location.href),
          seller:
            firstString(offers.map((o) => o?.seller).find((v) => v != null)) ??
            null,
          availability: (() => {
            const raw = (
              firstString(
                offers.map((o) => o?.availability).find((v) => v != null),
              ) ?? ""
            ).toLowerCase();
            if (!raw) return readAvailability(document.body);
            if (raw.includes("outofstock") || raw.includes("soldout")) {
              return "out_of_stock";
            }
            if (raw.includes("limitedavailability")) return "low_stock";
            if (raw.includes("instock")) return "in_stock";
            return readAvailability(document.body);
          })(),
          rating: (() => {
            const value = Number.parseFloat(
              firstString(product.aggregateRating?.ratingValue) ?? "",
            );
            return Number.isFinite(value) && value > 0 && value <= 5 ? value : null;
          })(),
          ratingCount: (() => {
            const value = Number.parseInt(
              (
                firstString(product.aggregateRating?.ratingCount) ??
                firstString(product.aggregateRating?.reviewCount) ??
                ""
              ).replace(/[^\d]/g, ""),
              10,
            );
            return Number.isFinite(value) && value > 0 ? value : null;
          })(),
          quantity: null,
        },
      ];
    }
    return [];
  }

  /* ---------------------------------------------------------------- *
   *  Selector-driven cart reader
   * ---------------------------------------------------------------- */

  function collectFromSelectors(storeKey, selectors) {
    const containers = [];
    for (const selector of selectors.item) {
      const found = [...document.querySelectorAll(selector)];
      if (found.length) {
        containers.push(...found);
        break;
      }
    }
    if (!containers.length) return [];

    const products = [];
    for (const container of containers) {
      const title = firstText(container, selectors.title);
      const brand = firstText(container, selectors.brand);
      const label = title || brand;
      if (!label) continue;

      const priceText = firstText(container, selectors.price);
      const originalText = firstText(container, selectors.originalPrice ?? []);
      const blockPrices = allPrices(clean(container.textContent));

      const price = parseMoney(priceText) ?? blockPrices[0] ?? null;
      let originalPrice = parseMoney(originalText);
      if (originalPrice == null && blockPrices.length > 1 && price != null) {
        const higher = blockPrices.filter((value) => value > price);
        originalPrice = higher.length ? Math.max(...higher) : null;
      }

      const href = productHref(container);
      const { rating, ratingCount } = readRating(container);

      products.push({
        // Myntra shows brand and name in separate lines; join them.
        title: brand && title && brand !== title ? `${brand} ${title}` : label,
        brand: brand || null,
        store: storeKey,
        price,
        originalPrice:
          originalPrice != null && price != null && originalPrice > price
            ? originalPrice
            : null,
        currency: "INR",
        imageUrl: imageFrom(container),
        productUrl: href,
        quantity: readQuantity(container),
        sizesAvailable: readSizesAvailable(container),
        seller: firstText(container, selectors.seller ?? []) || null,
        availability: readAvailability(container),
        sku: readSku(container, href),
        rating,
        ratingCount,
        size: readSize(container, selectors),
        color: firstText(container, selectors.color ?? []) || null,
      });
    }
    return products;
  }

  /* ---------------------------------------------------------------- *
   *  Heuristic reader — the safety net
   * ---------------------------------------------------------------- */

  function collectByHeuristic(storeKey) {
    const candidates = [];

    for (const node of document.querySelectorAll("li, div, article, section")) {
      const images = node.querySelectorAll("img");
      if (images.length !== 1) continue;

      const text = clean(node.textContent);
      if (!text || text.length > 400) continue;

      const prices = allPrices(text);
      if (!prices.length) continue;
      if (!node.querySelector("a[href]")) continue;

      candidates.push({ node, prices, text, depth: depthOf(node) });
    }
    if (!candidates.length) return [];

    // Keep the outermost block of each nested run, so one item counts once.
    candidates.sort((a, b) => a.depth - b.depth);
    const chosen = [];
    for (const candidate of candidates) {
      if (chosen.some((kept) => kept.node.contains(candidate.node))) continue;
      chosen.push(candidate);
    }
    if (chosen.length < 2) return [];

    return chosen
      .map((candidate) => {
        const { node, prices } = candidate;
        const title =
          clean(node.querySelector("img")?.getAttribute("alt")) ||
          longestLine(node) ||
          "";
        if (!title) return null;

        const price = Math.min(...prices);
        const originalPrice = prices.length > 1 ? Math.max(...prices) : null;

        return {
          title,
          brand: null,
          store: storeKey,
          price,
          originalPrice:
            originalPrice && originalPrice > price ? originalPrice : null,
          currency: "INR",
          imageUrl: imageFrom(node),
          productUrl: productHref(node),
          size: null,
          color: null,
        };
      })
      .filter(Boolean);
  }

  function depthOf(node) {
    let depth = 0;
    let current = node;
    while (current.parentElement) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }

  /** The longest piece of text that is not a price — usually the name. */
  function longestLine(node) {
    let best = "";
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = clean(walker.currentNode.textContent);
      if (!text || text.length < 6 || text.length > 160) continue;
      if (PRICE_RE.test(text)) continue;
      if (text.length > best.length) best = text;
    }
    return best;
  }

  /* ---------------------------------------------------------------- *
   *  The registry
   * ---------------------------------------------------------------- */

  const ADAPTERS = [
    {
      key: "myntra",
      label: "Myntra",
      hosts: [/(^|\.)myntra\.com$/],
      isBagPage: (url) =>
        /\/checkout\/cart/.test(url.pathname) ||
        /\/wishlist/.test(url.pathname) ||
        /\/bag/.test(url.pathname),
      // Myntra names classes `component-base-element-hash`, so match on prefix.
      selectors: {
        item: [
          '[class*="itemContainer-base-container"]',
          '[class*="itemContainer"]',
          '[class*="wishlistItem"]',
          '[class*="CartItem"]',
        ],
        brand: ['[class*="itemName-brand"]', '[class*="itemBrand"]', "h3"],
        title: ['[class*="itemName-name"]', '[class*="itemName"]', "h4"],
        price: [
          '[class*="discountedPriceText"]',
          '[class*="itemPrice-discounted"]',
          '[class*="price-discounted"]',
        ],
        originalPrice: [
          '[class*="originalPrice"]',
          '[class*="strikeThrough"]',
          "s",
          "del",
        ],
        size: ['[class*="sizeAndQuantity"]', '[class*="itemSize"]'],
        color: ['[class*="itemColor"]'],
        seller: ['[class*="itemSeller"]', '[class*="sellerName"]'],
      },
    },
    {
      key: "savana",
      label: "Savana",
      hosts: [/(^|\.)savana\.com$/, /(^|\.)savana\.in$/],
      isBagPage: (url) =>
        /\/(cart|bag|basket|wishlist|favourites|favorites)/i.test(url.pathname),
      selectors: {
        item: [
          '[data-testid*="cart-item"]',
          '[class*="cart-item"]',
          '[class*="cartItem"]',
          '[class*="line-item"]',
          '[class*="lineItem"]',
          '[class*="bag-item"]',
        ],
        brand: ['[class*="brand"]', '[class*="vendor"]'],
        title: [
          '[data-testid*="product-title"]',
          '[class*="product-title"]',
          '[class*="item-title"]',
          '[class*="productName"]',
          "h2",
          "h3",
          "a",
        ],
        price: [
          '[data-testid*="price"]',
          '[class*="final-price"]',
          '[class*="sale-price"]',
          '[class*="price"]',
        ],
        originalPrice: [
          '[class*="compare-at"]',
          '[class*="original-price"]',
          '[class*="was-price"]',
          "s",
          "del",
        ],
        size: ['[class*="size"]', '[class*="variant"]'],
        color: ['[class*="color"]', '[class*="colour"]'],
        seller: ['[class*="vendor"]', '[class*="seller"]'],
      },
    },
    {
      key: "zara",
      label: "Zara",
      hosts: [/(^|\.)zara\.com$/],
      isBagPage: (url) =>
        /\/(shop\/)?(cart|order|basket|wishlist)/i.test(url.pathname),
      selectors: {
        item: [
          '[class*="shop-cart-item"]',
          '[class*="cart-item"]',
          '[class*="order-summary__item"]',
          '[class*="wishlist-item"]',
          "li[class*='item']",
        ],
        brand: [],
        title: [
          '[class*="shop-cart-item-details__description"]',
          '[class*="item-details__description"]',
          '[class*="product-name"]',
          "a[href*='/p']",
          "h2",
          "h3",
        ],
        price: [
          '[class*="money-amount__main"]',
          '[class*="price-current"]',
          '[class*="price__amount"]',
        ],
        originalPrice: ['[class*="price-old"]', "s", "del"],
        size: ['[class*="item-details__size"]', '[class*="size"]'],
        color: ['[class*="item-details__color"]', '[class*="color"]'],
        seller: [],
      },
    },
    {
      key: "hm",
      label: "H&M",
      hosts: [/(^|\.)hm\.com$/],
      isBagPage: (url) =>
        /\/(cart|bag|basket|favourites|favorites)/i.test(url.pathname),
      selectors: {
        item: [
          '[class*="CartItemsList"] li',
          '[class*="cart-item"]',
          '[class*="ProductItem"]',
          '[data-testid*="cart-item"]',
          "article",
        ],
        brand: [],
        title: [
          '[class*="item-heading"]',
          '[class*="ProductName"]',
          '[class*="product-title"]',
          "h2",
          "h3",
          "a",
        ],
        price: ['[class*="item-price"]', '[class*="Price"]', '[class*="price"]'],
        originalPrice: ['[class*="oldPrice"]', '[class*="old-price"]', "s", "del"],
        size: ['[class*="item-details-size"]', '[class*="size"]'],
        color: [
          '[class*="item-details-color"]',
          '[class*="colour"]',
          '[class*="color"]',
        ],
        seller: [],
      },
    },
    {
      key: "ajio",
      label: "Ajio",
      hosts: [/(^|\.)ajio\.com$/],
      isBagPage: (url) => /\/(cart|bag|closet|wishlist)/i.test(url.pathname),
      selectors: {
        item: [
          '[class*="cart-item"]',
          '[class*="item-container"]',
          '[class*="bag-item"]',
          '[class*="closet-item"]',
        ],
        brand: ['[class*="brand-name"]', '[class*="brand"]'],
        title: ['[class*="item-name"]', '[class*="name"]', "h3", "a"],
        price: [
          '[class*="price-value"]',
          '[class*="offer-price"]',
          '[class*="price"]',
        ],
        originalPrice: [
          '[class*="orginal-price"]',
          '[class*="original-price"]',
          "s",
          "del",
        ],
        size: ['[class*="item-size"]', '[class*="size"]'],
        color: ['[class*="item-color"]', '[class*="color"]'],
        seller: ['[class*="seller"]'],
      },
    },
    {
      key: "nykaa",
      label: "Nykaa",
      hosts: [/(^|\.)nykaa\.com$/, /(^|\.)nykaafashion\.com$/],
      isBagPage: (url) => /\/(cart|bag|wishlist)/i.test(url.pathname),
      selectors: {
        item: [
          '[class*="cart-item"]',
          '[class*="CartItem"]',
          '[class*="product-card"]',
          '[class*="wishlist-item"]',
        ],
        brand: ['[class*="brand"]'],
        title: ['[class*="product-title"]', '[class*="title"]', "h3", "a"],
        price: ['[class*="post-card__content-price-offer"]', '[class*="price"]'],
        originalPrice: ['[class*="price-strike"]', '[class*="mrp"]', "s", "del"],
        size: ['[class*="size"]', '[class*="variant"]'],
        color: ['[class*="shade"]', '[class*="color"]'],
        seller: ['[class*="seller"]'],
      },
    },
    {
      key: "urbanic",
      label: "Urbanic",
      hosts: [/(^|\.)urbanic\.com$/],
      isBagPage: (url) => /\/(cart|bag|wishlist|favourites)/i.test(url.pathname),
      selectors: {
        item: [
          '[class*="cart-item"]',
          '[class*="cartItem"]',
          '[class*="bag-item"]',
          '[class*="goods-item"]',
        ],
        brand: [],
        title: ['[class*="goods-name"]', '[class*="product-name"]', "h3", "a"],
        price: ['[class*="sale-price"]', '[class*="price"]'],
        originalPrice: [
          '[class*="market-price"]',
          '[class*="origin-price"]',
          "s",
          "del",
        ],
        size: ['[class*="size"]', '[class*="spec"]'],
        color: ['[class*="color"]'],
        seller: [],
      },
    },
  ];

  function adapterFor(url) {
    return (
      ADAPTERS.find((adapter) =>
        adapter.hosts.some((pattern) => pattern.test(url.hostname)),
      ) ?? null
    );
  }

  /** Deduplicate by product link, then by name. */
  function dedupe(products) {
    const seen = new Set();
    const output = [];
    for (const product of products) {
      const key = (product.productUrl || product.title || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(product);
    }
    return output;
  }

  /**
   * Reads whatever this page is willing to give up.
   * Returns { store, label, isBagPage, strategy, products }.
   */
  function collect() {
    const url = new URL(location.href);
    const adapter = adapterFor(url);
    const storeKey = adapter?.key ?? "other";
    const isBagPage = adapter ? adapter.isBagPage(url) : false;

    if (adapter && isBagPage) {
      const fromSelectors = dedupe(
        collectFromSelectors(storeKey, adapter.selectors),
      );
      if (fromSelectors.length) {
        return {
          store: storeKey,
          label: adapter.label,
          isBagPage,
          strategy: "selectors",
          products: fromSelectors,
        };
      }

      const heuristic = dedupe(collectByHeuristic(storeKey));
      if (heuristic.length) {
        return {
          store: storeKey,
          label: adapter.label,
          isBagPage,
          strategy: "heuristic",
          products: heuristic,
        };
      }
    }

    const single = dedupe(collectFromJsonLd(storeKey));
    if (single.length) {
      return {
        store: storeKey,
        label: adapter?.label ?? url.hostname,
        isBagPage,
        strategy: "structured",
        products: single,
      };
    }

    const heuristic = dedupe(collectByHeuristic(storeKey));
    return {
      store: storeKey,
      label: adapter?.label ?? url.hostname,
      isBagPage,
      strategy: heuristic.length ? "heuristic" : "none",
      products: heuristic,
    };
  }

  /* ---------------------------------------------------------------- *
   *  Reading a page that offers no structured data
   *
   *  Plenty of smaller shops ship neither JSON-LD nor OpenGraph tags. What
   *  they always have is the product visible on screen, so fall back to
   *  reading it the way a person would: the heading, the biggest picture,
   *  and the price nearest the buy button.
   * ---------------------------------------------------------------- */

  function visibleTitle() {
    for (const selector of [
      "h1",
      '[class*="product-title"]',
      '[class*="product-name"]',
      '[class*="productTitle"]',
      '[itemprop="name"]',
    ]) {
      const text = clean(document.querySelector(selector)?.textContent);
      if (text && text.length > 2 && text.length < 200) return text;
    }
    // Page titles usually carry the shop name; drop the tail.
    const title = clean(document.title).split(/\s[|\u2013\u2014-]\s/)[0];
    return title && title.length > 2 ? title : null;
  }

  /** The biggest picture on the page that is not a logo or an icon. */
  function visibleImage() {
    let best = null;
    let bestArea = 0;

    for (const img of document.images) {
      const source = img.currentSrc || img.src || "";
      if (!source || source.startsWith("data:")) continue;
      if (/logo|sprite|icon|placeholder|badge/i.test(source)) continue;

      const rect = img.getBoundingClientRect();
      const area = Math.max(rect.width * rect.height, 0);
      // Product shots are large and portrait-ish; navigation art is not.
      if (rect.width < 120 || rect.height < 120) continue;
      if (area > bestArea) {
        bestArea = area;
        best = source;
      }
    }
    return absolute(best);
  }

  /**
   * The price, preferring whatever sits closest to the add-to-cart button —
   * a product page is usually littered with other numbers.
   */
  function visiblePrice() {
    const labelled = firstText(document.body, [
      '[class*="product-price"]',
      '[class*="productPrice"]',
      '[class*="price-item--sale"]',
      '[class*="price__current"]',
      '[itemprop="price"]',
      '[class*="current-price"]',
      '[class*="sale-price"]',
      '[data-testid*="price"]',
    ]);
    const direct = parseMoney(labelled);
    if (direct) return { price: direct, originalPrice: null };

    const found = allPrices(clean(document.body.textContent).slice(0, 6000));
    if (!found.length) return { price: null, originalPrice: null };

    // Two figures side by side is nearly always sale-then-original.
    const price = Math.min(...found);
    const highest = Math.max(...found);
    return {
      price,
      originalPrice: highest > price ? highest : null,
    };
  }
  /**
   * The single piece this product page is about, with the size she picked.
   *
   * Used the moment she presses "Add to bag" — at that point the cart page
   * does not exist yet, so `collect()`'s cart path has nothing to read.
   */
  function collectCurrent() {
    const url = new URL(location.href);
    const adapter = adapterFor(url);
    const storeKey = adapter?.key ?? "other";

    const found = dedupe(collectFromJsonLd(storeKey));
    const product = found[0] ?? null;

    // Whatever the page shows on screen, used to fill any gaps.
    const seen = visiblePrice();

    if (!product) {
      const title = visibleTitle();
      if (!title) return null;

      return {
        title,
        brand: null,
        store: storeKey,
        price: seen.price,
        originalPrice: seen.originalPrice,
        currency: "INR",
        imageUrl: visibleImage(),
        productUrl: location.href,
        size: readSelectedSize(document),
        sizesAvailable: readSizesAvailable(document.body),
        color: null,
        quantity: 1,
        seller: null,
        rating: null,
        ratingCount: null,
        sku: readSku(document.body, location.href),
        availability: readAvailability(document.body),
      };
    }
    return {
      ...product,
      // Structured data is often partial: a name and nothing else. Anything
      // it left blank is filled from what the page actually shows, so a
      // piece never lands in her wardrobe as an empty card.
      title: product.title || visibleTitle(),
      imageUrl: product.imageUrl || visibleImage(),
      price: product.price ?? seen.price,
      originalPrice: product.originalPrice ?? seen.originalPrice,
      productUrl: product.productUrl || location.href,
      size: readSelectedSize(document) ?? product.size ?? null,
      quantity: product.quantity ?? 1,
    };
  }

  self.MonAmourAdapters = { collect, collectCurrent, ADAPTERS, parseMoney };
})();
