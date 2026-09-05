"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateDisplayName } from "@/core/profile/actions";
import { updateDisplayNameSchema, type UpdateDisplayNameInput } from "@/core/profile/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";

export function DisplayNameForm({ initial }: { initial: string }) {
  const t = useTranslations("settings.profile");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateDisplayNameInput>({
    resolver: zodResolver(updateDisplayNameSchema),
    defaultValues: { displayName: initial },
  });

  function submit(values: UpdateDisplayNameInput) {
    startTransition(async () => {
      const result = await updateDisplayName(values);
      if (!result.ok) {
        toast.error(te("generic"));
        return;
      }
      toast.success(t("savedToast"));
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>{t("displayName")}</FormLabel>
              <FormControl>
                <Input placeholder={t("displayNamePlaceholder")} className="h-12 text-body" {...field} />
              </FormControl>
              <FormMessageI18n />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </form>
    </Form>
  );
}
