// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "./sheet";

const localeCases = [
  { locale: "th", messages: thaiMessages },
  { locale: "en", messages: englishMessages },
] as const;

describe("localized dialog and sheet close controls", () => {
  it.each(localeCases)("localizes dialog close controls for $locale", ({ locale, messages }) => {
    const onOpenChange = vi.fn();

    render(
      <NextIntlClientProvider locale={locale} timeZone="Asia/Bangkok" messages={messages}>
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      </NextIntlClientProvider>,
    );

    const closeButtons = screen.getAllByRole("button", { name: messages.common.close });
    expect(closeButtons).toHaveLength(2);

    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);

    expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
  });

  it.each(localeCases)("localizes sheet close control for $locale", ({ locale, messages }) => {
    const onOpenChange = vi.fn();

    render(
      <NextIntlClientProvider locale={locale} timeZone="Asia/Bangkok" messages={messages}>
        <Sheet open onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>Sheet title</SheetTitle>
            <SheetDescription>Sheet description</SheetDescription>
          </SheetContent>
        </Sheet>
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: messages.common.close }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
