import { SegmentedNav } from "@/components/ui/segmented-nav";

export type PeriodSelectorItem = {
  key: string;
  href: string;
  label: string;
  active: boolean;
};

export function PeriodSelector({
  label,
  items,
}: {
  label: string;
  items: PeriodSelectorItem[];
}) {
  return <SegmentedNav label={label} items={items} />;
}
