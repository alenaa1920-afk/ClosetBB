/**
 * The twelve drawers of the wardrobe, plus keyword auto-categorisation so a
 * pasted link or a scraped cart lands in the right place without being asked.
 */

export const CATEGORIES = {
  dresses: "Dresses",
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
  bags: "Bags",
  accessories: "Accessories",
  jewelry: "Jewelry",
  beauty: "Beauty",
  makeup: "Makeup",
  skincare: "Skincare",
  electronics: "Electronics",
  others: "Others",
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === "string" && value in CATEGORIES;
}

export function categoryLabel(key: CategoryKey | string): string {
  return isCategoryKey(key) ? CATEGORIES[key] : CATEGORIES.others;
}

/**
 * Phrases that identify a drawer. Matching is longest-phrase-first, so
 * "hair oil" beats "oil" and "smart watch" beats "watch" without needing
 * the categories themselves to be carefully ordered.
 */
const KEYWORDS: Record<Exclude<CategoryKey, "others">, readonly string[]> = {
  dresses: [
    "dress",
    "gown",
    "frock",
    "maxi",
    "midi",
    "bodycon",
    "jumpsuit",
    "playsuit",
    "romper",
    "kaftan",
    "saree",
    "sari",
    "lehenga",
    "kurta",
    "kurti",
    "anarkali",
    "salwar",
  ],
  tops: [
    "top",
    "shirt",
    "t-shirt",
    "tshirt",
    "tee",
    "blouse",
    "tank",
    "camisole",
    "cami",
    "crop top",
    "bralette",
    "sweater",
    "pullover",
    "cardigan",
    "hoodie",
    "sweatshirt",
    "jacket",
    "blazer",
    "coat",
    "shrug",
    "corset",
    "bodysuit",
  ],
  bottoms: [
    "jeans",
    "denim",
    "trouser",
    "pants",
    "skirt",
    "shorts",
    "legging",
    "jegging",
    "palazzo",
    "culotte",
    "jogger",
    "chino",
    "cargo",
    "dungaree",
    "sharara",
  ],
  shoes: [
    "shoe",
    "heel",
    "sneaker",
    "trainer",
    "boot",
    "sandal",
    "flats",
    "ballerina",
    "loafer",
    "mule",
    "stiletto",
    "pump",
    "slipper",
    "flip flop",
    "wedge",
    "espadrille",
    "kolhapuri",
    "juti",
  ],
  bags: [
    "bag",
    "handbag",
    "tote",
    "clutch",
    "purse",
    "backpack",
    "sling",
    "satchel",
    "wallet",
    "pouch",
    "duffle",
    "baguette bag",
  ],
  accessories: [
    "scarf",
    "stole",
    "belt",
    "hat",
    "cap",
    "beret",
    "sunglass",
    "eyewear",
    "watch",
    "scrunchie",
    "hair clip",
    "hair band",
    "headband",
    "glove",
    "socks",
    "stocking",
    "umbrella",
    "keychain",
  ],
  jewelry: [
    "earring",
    "necklace",
    "ring",
    "bracelet",
    "anklet",
    "pendant",
    "jewellery",
    "jewelry",
    "choker",
    "stud",
    "hoop",
    "bangle",
    "brooch",
    "charm",
    "nose pin",
    "maang tikka",
  ],
  beauty: [
    "perfume",
    "fragrance",
    "eau de",
    "body mist",
    "shampoo",
    "conditioner",
    "hair oil",
    "hair mask",
    "body wash",
    "body lotion",
    "deodorant",
    "beauty",
    "nail",
    "hair serum",
  ],
  makeup: [
    "lipstick",
    "lip gloss",
    "lipgloss",
    "lip tint",
    "lip liner",
    "mascara",
    "foundation",
    "concealer",
    "blush",
    "eyeliner",
    "kajal",
    "kohl",
    "eyeshadow",
    "eye palette",
    "compact",
    "primer",
    "highlighter",
    "bronzer",
    "setting spray",
    "makeup",
    "mua",
  ],
  skincare: [
    "serum",
    "moisturiser",
    "moisturizer",
    "cleanser",
    "face wash",
    "sunscreen",
    "spf",
    "toner",
    "face mask",
    "sheet mask",
    "face cream",
    "night cream",
    "eye cream",
    "face oil",
    "body oil",
    "exfoliat",
    "scrub",
    "retinol",
    "niacinamide",
    "hyaluronic",
    "vitamin c",
    "lip balm",
    "skincare",
  ],
  electronics: [
    "headphone",
    "earphone",
    "earbud",
    "airpod",
    "smart watch",
    "smartwatch",
    "fitness band",
    "speaker",
    "charger",
    "power bank",
    "laptop",
    "tablet",
    "kindle",
    "camera",
    "hair dryer",
    "hair straightener",
    "straightener",
    "curler",
    "epilator",
    "trimmer",
  ],
};

/** Flattened and sorted once at module load. */
const PHRASES: ReadonlyArray<{ phrase: string; category: CategoryKey }> =
  Object.entries(KEYWORDS)
    .flatMap(([category, phrases]) =>
      phrases.map((phrase) => ({ phrase, category: category as CategoryKey })),
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);

const WORD_EDGE = /[a-z0-9]/i;

/** Phrase match that respects word edges, so "top" never matches "laptop". */
function containsPhrase(haystack: string, phrase: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(phrase, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + phrase.length] ?? "";
    const openLeft = !before || !WORD_EDGE.test(before);
    // Allow a trailing plural or possessive: "dresses", "bags".
    const openRight =
      !after ||
      !WORD_EDGE.test(after) ||
      /^(s|es|'s)\b/.test(haystack.slice(at + phrase.length));
    if (openLeft && openRight) return true;
    from = at + 1;
  }
}

/**
 * Best-guess drawer for a product, from its title, brand and any breadcrumb
 * text the source page offered. Falls back to `others`, never throws.
 */
export function categorise(
  ...parts: Array<string | null | undefined>
): CategoryKey {
  const haystack = parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  if (!haystack) return "others";
  for (const { phrase, category } of PHRASES) {
    if (containsPhrase(haystack, phrase)) return category;
  }
  return "others";
}
