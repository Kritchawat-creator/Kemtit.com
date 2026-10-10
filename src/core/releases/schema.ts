import { z } from "zod";

const plainTextItemSchema = z.string().trim().min(1).max(1000);
const localizedItemsSchema = z.array(plainTextItemSchema).max(20);

export const releaseNoteRowSchema = z
  .object({
    id: z.uuid(),
    version: z.string().trim().min(1).max(64),
    build_id: z.string().trim().min(1).max(128),
    title_th: z.string().trim().min(1).max(200),
    title_en: z.string().trim().min(1).max(200),
    new_items_th: localizedItemsSchema,
    new_items_en: localizedItemsSchema,
    improved_items_th: localizedItemsSchema,
    improved_items_en: localizedItemsSchema,
    fixed_items_th: localizedItemsSchema,
    fixed_items_en: localizedItemsSchema,
    published_at: z.string().min(1),
    created_at: z.string().min(1),
  })
  .refine((row) => row.new_items_th.length === row.new_items_en.length)
  .refine((row) => row.improved_items_th.length === row.improved_items_en.length)
  .refine((row) => row.fixed_items_th.length === row.fixed_items_en.length)
  .refine(
    (row) =>
      row.new_items_th.length + row.improved_items_th.length + row.fixed_items_th.length > 0,
  );

export const acknowledgeReleaseNoteSchema = z
  .object({ releaseNoteId: z.uuid() })
  .strict();

export type ReleaseNoteRow = z.infer<typeof releaseNoteRowSchema>;
