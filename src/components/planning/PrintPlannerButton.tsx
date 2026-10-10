"use client";

import { useTranslations } from "next-intl";

import styles from "./PrintPlanner.module.css";

export function PrintPlannerButton() {
  const t = useTranslations("plannerPrint");
  return (
    <button type="button" className={styles.toolbarButton} onClick={() => window.print()}>
      {t("saveAsPdf")}
    </button>
  );
}
