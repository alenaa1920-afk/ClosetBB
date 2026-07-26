import type { CategoryKey } from "./categories";
import type { StoreKey } from "./stores";

/**
 * What /api/unfurl gives back from a pasted product link. Every field is a
 * suggestion — the add sheet keeps all of it editable.
 */
export interface Unfurled {
  url: string;
  title: string | null;
  brand: string | null;
  store: StoreKey;
  category: CategoryKey;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  color: string | null;
  size: string | null;
  siteName: string | null;
}

export interface UnfurlFailure {
  error: string;
  /** What to try instead — usually "use the extension on this shop". */
  hint?: string;
}

export type UnfurlResponse = Unfurled | UnfurlFailure;

export function isUnfurlFailure(value: UnfurlResponse): value is UnfurlFailure {
  return "error" in value;
}
