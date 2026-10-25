// Kept free of drizzle imports so client bundles can use it via the shared Zod schema.
export const LISTING_CATEGORIES = [
  "Buy Property",
  "Buy land to build homestay",
  "Buy Airbnb Profile",
  "Buy Airbnb Business",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
