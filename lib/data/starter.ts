import {
  buildCollection,
  STARTER_COLLECTIONS,
  type Collection,
} from "@/lib/domain/product";
import type { WardrobeSnapshot } from "./repository";

/**
 * A brand-new wardrobe: the occasions rail ready to receive things, and no
 * products at all.
 *
 * There is deliberately no sample data. Everything in Mon Amour is a real
 * piece she actually chose — a fabricated dress with a fabricated price would
 * be a lie sitting in her closet.
 */
export function buildStarter(userId: string): WardrobeSnapshot {
  const collections: Collection[] = STARTER_COLLECTIONS.map(({ name, emoji }) =>
    buildCollection(name, userId, emoji),
  );

  return { userId, products: [], collections };
}
