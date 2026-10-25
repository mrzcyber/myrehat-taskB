import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { LISTING_CATEGORIES } from "../listing-categories";
import { user } from "./auth";

export const listingCategory = pgEnum("listing_category", LISTING_CATEGORIES);

export const listing = pgTable(
  "listing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    location: text("location").notNull(),
    category: listingCategory("category").notNull(),
    whatsapp: text("whatsapp").notNull(),
    description: text("description"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("listing_userId_idx").on(table.userId),
    index("listing_createdAt_idx").on(table.createdAt),
  ],
);
