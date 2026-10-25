import { LISTING_CATEGORIES } from "@myrehat-task-b/db/listing-categories";
import z from "zod";

export { LISTING_CATEGORIES };

export const listingCategorySchema = z.enum(LISTING_CATEGORIES, {
  error: "Choose one of the 4 categories",
});

// Accepts 08xx / 628xx / +628xx with spaces or dashes; normalises to 628xx for wa.me links.
export const whatsappSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .pipe(z.string().regex(/^(\+?62|0)8\d{7,12}$/, "Enter a valid Indonesian WhatsApp number"))
  .transform((v) => v.replace(/^(\+?62|0)/, "62"));

export const createListingInput = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120),
  price: z.coerce
    .number({ error: "Price must be a number" })
    .int("Price must be a whole number")
    .positive("Price must be greater than 0")
    .max(Number.MAX_SAFE_INTEGER),
  location: z.string().trim().min(2, "Location is required").max(120),
  category: listingCategorySchema,
  whatsapp: whatsappSchema,
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
});

export type CreateListingInput = z.output<typeof createListingInput>;
