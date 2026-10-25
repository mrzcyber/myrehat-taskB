import { headers } from "next/headers";
import { redirect } from "next/navigation";

import ListingForm from "@/components/listing-form";
import { authClient } from "@/lib/auth-client";

export default async function NewListingPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">New BuyHomestay listing</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Buyers will contact you directly on WhatsApp.
      </p>
      <ListingForm />
    </div>
  );
}
