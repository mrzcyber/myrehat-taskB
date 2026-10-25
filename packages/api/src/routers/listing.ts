import { listing, user } from "@myrehat-task-b/db/schema/index";
import { desc, eq } from "drizzle-orm";

import { protectedProcedure, publicProcedure } from "../index";
import { createListingInput } from "../schemas/listing";

export const listingRouter = {
  list: publicProcedure.handler(async ({ context }) => {
    return context.db
      .select({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        location: listing.location,
        category: listing.category,
        whatsapp: listing.whatsapp,
        description: listing.description,
        createdAt: listing.createdAt,
        hostName: user.name,
      })
      .from(listing)
      .innerJoin(user, eq(listing.userId, user.id))
      .orderBy(desc(listing.createdAt))
      .limit(100);
  }),
  create: protectedProcedure.input(createListingInput).handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(listing)
      .values({ ...input, userId: context.session.user.id })
      .returning();
    return created;
  }),
};
