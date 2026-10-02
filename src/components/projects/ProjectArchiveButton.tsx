"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { archiveProject } from "@/core/projects/actions";
import { Button } from "@/components/ui/button";

export function ProjectArchiveButton({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      onClick={() =>
        startTransition(async () => {
          const result = await archiveProject({ id: projectId });
          if (!result.ok) {
            toast.error(t("errors.generic"));
            return;
          }
          toast.success(t("projects.archived"));
          router.push("/work/projects");
        })
      }
      disabled={pending}
    >
      <Archive aria-hidden="true" />
      {t("projects.archive")}
    </Button>
  );
}
