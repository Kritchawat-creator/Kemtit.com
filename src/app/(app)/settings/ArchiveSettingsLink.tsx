import { Archive } from "@/components/icons/ui-icons";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export async function ArchiveSettingsLink() {
  const t = await getTranslations("archive");

  return (
    <Button asChild type="button" variant="outline">
      <Link href="/archive">
        <Archive aria-hidden="true" />
        {t("title")}
      </Link>
    </Button>
  );
}
