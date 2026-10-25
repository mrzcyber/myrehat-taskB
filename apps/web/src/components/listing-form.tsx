"use client";

import { createListingInput, LISTING_CATEGORIES } from "@myrehat-task-b/api/schemas/listing";
import { Button } from "@myrehat-task-b/ui/components/button";
import { Input } from "@myrehat-task-b/ui/components/input";
import { Label } from "@myrehat-task-b/ui/components/label";
import { Textarea } from "@myrehat-task-b/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const selectClassName =
  "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30";

function FieldErrors({ errors }: { errors: unknown[] }) {
  return errors.map((error) => (
    <p key={String(error)} className="text-xs text-red-500">
      {String(error)}
    </p>
  ));
}

export default function ListingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createListing = useMutation(
    orpc.listing.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.listing.list.key() });
        toast.success("Listing published");
        router.push("/listings");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      title: "",
      price: "",
      location: "",
      category: "" as string,
      whatsapp: "",
      description: "",
    },
    validators: {
      // Same schema the server uses; issues are mapped onto their fields.
      onSubmit: ({ value }) => {
        const result = createListingInput.safeParse(value);
        if (result.success) return undefined;
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          fields[key] ??= issue.message;
        }
        return { fields };
      },
    },
    onSubmit: async ({ value }) => {
      await createListing.mutateAsync(createListingInput.parse(value));
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="title">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Title</Label>
            <Input
              id={field.name}
              name={field.name}
              placeholder="Beachfront villa in Canggu"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="price">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Price (IDR)</Label>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="2500000000"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="location">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Location</Label>
              <Input
                id={field.name}
                name={field.name}
                placeholder="Canggu, Bali"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="category">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Category</Label>
            <select
              id={field.name}
              name={field.name}
              className={selectClassName}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            >
              <option value="" disabled>
                Select a category
              </option>
              {LISTING_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <FieldErrors errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="whatsapp">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>WhatsApp contact</Label>
            <Input
              id={field.name}
              name={field.name}
              type="tel"
              inputMode="tel"
              placeholder="0812 3456 7890"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Description (optional)</Label>
            <Textarea
              id={field.name}
              name={field.name}
              rows={4}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Publishing..." : "Publish listing"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
