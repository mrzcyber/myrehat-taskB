"use client";
import { buttonVariants } from "@myrehat-task-b/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-20">
      <section className="text-center">
        <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          MyRehat
        </p>
        <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Book homestays directly with hosts
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
          No middleman fees. Chat with the host on WhatsApp, agree on your dates, and stay.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/listings" className={buttonVariants({ size: "lg" })}>
            Browse listings
          </Link>
          <Link href="/listings/new" className={buttonVariants({ size: "lg", variant: "outline" })}>
            List your property
          </Link>
        </div>
      </section>

      <div className="mt-16 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div
          className={`h-2 w-2 rounded-full ${healthCheck.data ? "bg-green-500" : "bg-red-500"}`}
        />
        API{" "}
        {healthCheck.isLoading ? "checking..." : healthCheck.data ? "connected" : "disconnected"}
      </div>
    </div>
  );
}
