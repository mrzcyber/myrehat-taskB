import { listingCategory } from "@myrehat-task-b/db/schema/listing";
import { describe, expect, it } from "vitest";

import { createListingInput, LISTING_CATEGORIES, listingCategorySchema } from "./listing";

const validListing = {
  title: "Villa Canggu 3BR",
  price: "2500000000",
  location: "Canggu, Bali",
  category: "Buy Property",
  whatsapp: "0812-3456-7890",
};

describe("listing categories", () => {
  it("has exactly the 4 BuyHomestay categories, in dropdown order", () => {
    expect(LISTING_CATEGORIES).toEqual([
      "Buy Property",
      "Buy land to build homestay",
      "Buy Airbnb Profile",
      "Buy Airbnb Business",
    ]);
  });

  it("keeps the database enum in sync with the form options", () => {
    expect(listingCategory.enumValues).toEqual([...LISTING_CATEGORIES]);
  });

  it.each(LISTING_CATEGORIES)("accepts %s", (category) => {
    expect(listingCategorySchema.safeParse(category).success).toBe(true);
    const result = createListingInput.safeParse({ ...validListing, category });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBe(category);
  });

  it("rejects a category outside the 4 options", () => {
    const result = createListingInput.safeParse({ ...validListing, category: "Rent Villa" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ["category"],
          message: "Choose one of the 4 categories",
        }),
      ]);
    }
  });

  it.each(["", "buy property", "Buy Property ", "Buy Airbnb"])(
    "rejects near-miss category %j (exact match only)",
    (category) => {
      expect(listingCategorySchema.safeParse(category).success).toBe(false);
    },
  );
});

describe("createListingInput", () => {
  it("normalises WhatsApp numbers to 62xxx and coerces price", () => {
    const result = createListingInput.parse(validListing);
    expect(result.whatsapp).toBe("6281234567890");
    expect(result.price).toBe(2_500_000_000);
    expect(result.description).toBeUndefined();
  });

  it.each(["+62 812 3456 7890", "62-812-3456-7890", "081234567890"])(
    "accepts WhatsApp format %j",
    (whatsapp) => {
      expect(createListingInput.parse({ ...validListing, whatsapp }).whatsapp).toBe("6281234567890");
    },
  );

  it.each([
    ["title too short", { title: "Vil" }, "title"],
    ["zero price", { price: "0" }, "price"],
    ["non-numeric price", { price: "dua juta" }, "price"],
    ["empty location", { location: " " }, "location"],
    ["invalid WhatsApp", { whatsapp: "12345" }, "whatsapp"],
  ])("rejects %s", (_name, override, path) => {
    const result = createListingInput.safeParse({ ...validListing, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.path[0])).toContain(path);
  });
});
