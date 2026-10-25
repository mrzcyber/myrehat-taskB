"use client";

import { buttonVariants } from "@myrehat-task-b/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@myrehat-task-b/ui/components/card";
import { Skeleton } from "@myrehat-task-b/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function ListingsPage() {
  const listings = useQuery(orpc.listing.list.queryOptions());

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">BuyHomestay listings</h1>
          <p className="text-sm text-muted-foreground">
            Properties, land and Airbnb businesses for sale, straight from the owners.
          </p>
        </div>
        <Link href="/listings/new" className={buttonVariants()}>
          + New listing
        </Link>
      </div>

      {listings.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : listings.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.data.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <span className="w-fit rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {item.category}
                </span>
                <CardTitle className="break-words">{item.title}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" />
                  {item.location}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-lg font-semibold">{idr.format(item.price)}</p>
                {item.description ? (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">by {item.hostName}</span>
                <a
                  href={`https://wa.me/${item.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  WhatsApp
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No listings yet. Be the first to post one.
        </p>
      )}
    </div>
  );
}
