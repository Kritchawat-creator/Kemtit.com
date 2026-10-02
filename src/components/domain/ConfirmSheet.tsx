import type { ReactNode } from "react";

import {
  ResponsiveDialog,
  type ResponsiveDialogProps,
} from "@/components/ui/responsive-dialog";

type Props = Pick<ResponsiveDialogProps, "onOpenAutoFocus" | "onCloseAutoFocus"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {children}
    </ResponsiveDialog>
  );
}
