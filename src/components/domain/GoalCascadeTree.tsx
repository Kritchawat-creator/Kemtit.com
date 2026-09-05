"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import type { GoalTreeNode } from "@/core/goals/queries";

import { GoalCard } from "./GoalCard";

type Props = { nodes: GoalTreeNode[]; depth?: number };

/** tree ปี→เดือน→สัปดาห์ แบบพับได้ (Design §6.2) — ชั้นแรกเปิดไว้ ชั้นถัดไปพับ */
export function GoalCascadeTree({ nodes, depth = 0 }: Props) {
  return (
    <ul className={cn("space-y-2", depth > 0 && "mt-2 border-l-2 border-brand-100 pl-3")}>
      {nodes.map((node) => (
        <TreeItem key={node.goal.id} node={node} depth={depth} />
      ))}
    </ul>
  );
}

function TreeItem({ node, depth }: { node: GoalTreeNode; depth: number }) {
  const t = useTranslations("a11y");
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={t("toggleChildren", { title: node.goal.title })}
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex size-11 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-9"
          >
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden="true" />
          </button>
        ) : (
          <span className="size-11 shrink-0 md:size-9" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <GoalCard goal={node.goal} compact />
        </div>
      </div>
      {hasChildren && open ? <GoalCascadeTree nodes={node.children} depth={depth + 1} /> : null}
    </li>
  );
}
