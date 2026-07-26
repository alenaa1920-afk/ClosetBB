/**
 * Reads a price out of raw HTML, without a DOM.
 *
 * MV3 service workers have no DOMParser, and we do not want to open a tab for
 * every piece being re-checked — so this works on the markup as text, the same
 * way the server-side parser does.
 */

const MA_PRICE = (() => {
  "use strict";

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

  /** A meta tag's content, whichever order the attributes appear in. */
  function meta(html, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name|itemprop)\\s*=\\s*["']${escaped}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  /** Walks JSON-LD blocks for the first Product's offer price. */
  function fromJsonLd(html) {
    const blocks = html.matchAll(
      /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );

    for (const block of blocks) {
      let parsed;
      try {
        parsed = JSON.parse((block[1] || "").trim());
      } catch {
        continue;
      }

      const found = findProduct(parsed, 0);
      if (!found) continue;

      const offers = [].concat(found.offers ?? []).flatMap((offer) => {
        if (!offer || typeof offer !== "object") return [];
        return Array.isArray(offer.offers) ? [offer, ...offer.offers] : [offer];
      });

      for (const offer of offers) {
        const price =
          normaliseNumber(offer?.price ?? "") ??
          normaliseNumber(offer?.lowPrice ?? "");
        if (price != null) return price;
      }
    }
    return null;
  }

  function findProduct(node, depth) {
    if (depth > 8 || !node || typeof node !== "object") return null;

    if (Array.isArray(node)) {
      for (const entry of node) {
        const found = findProduct(entry, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const types = []
      .concat(node["@type"] ?? [])
      .filter((type) => typeof type === "string")
      .map((type) => type.toLowerCase());
    if (types.includes("product")) return node;

    for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant"]) {
      if (key in node) {
        const found = findProduct(node[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function availabilityFrom(html) {
    const raw = (
      /"availability"\s*:\s*"([^"]+)"/i.exec(html)?.[1] ?? ""
    ).toLowerCase();
    if (raw.includes("outofstock") || raw.includes("soldout"))
      return "out_of_stock";
    if (raw.includes("limitedavailability")) return "low_stock";
    if (raw.includes("instock")) return "in_stock";
    if (/\b(out of stock|sold out)\b/i.test(html)) return "out_of_stock";
    return null;
  }

  /** Best price this markup will give up, or null. */
  function read(html) {
    const price =
      fromJsonLd(html) ??
      normaliseNumber(
        meta(html, "product:price:amount") ??
          meta(html, "og:price:amount") ??
          meta(html, "price") ??
          "",
      );

    return { price, availability: availabilityFrom(html) };
  }

  return { read, normaliseNumber };
})();

// Reachable from the service worker after importScripts.
self.MA_PRICE = MA_PRICE;
