"use client";

import { MessageCircle, Sparkles } from "@/components/icons/ui-icons";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useFeedbackHost } from "./FeedbackHost";

export function FeedbackSettingsLinks() {
  const t = useTranslations();
  const { openFeedback } = useFeedbackHost();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={(event) => openFeedback(event.currentTarget)}
      >
        <MessageCircle aria-hidden="true" />
        {t("feedback.open")}
      </Button>
      <Button asChild variant="link" className="justify-start px-2">
        <Link href="/updates">
          <Sparkles aria-hidden="true" />
          {t("updates.title")}
        </Link>
      </Button>
    </div>
  );
}
