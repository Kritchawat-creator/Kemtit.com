"use client";

import type * as React from "react";
import { useCallback, useSyncExternalStore } from "react";
import { cn } from "cn";

import { Sidebar } from "./Sidebar";

const STORAGE_KEY = "kemtit.sidebarCollapsed";
const EVENT = "kemtit:sidebar";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * โครง desktop (Claude Design turn 4): sidebar ซ้ายพับได้ (240 → 72px) จำสถานะใน localStorage
 * เนื้อหาเลื่อนตามความกว้าง sidebar · มือถือไม่มี sidebar (bottom nav แทน)
 */
export function ShellFrame({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, readCollapsed() ? "0" : "1");
    } catch {
      // private mode — ไม่จำสถานะ
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return (
    <div className="min-h-dvh bg-bg-page">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          "relative min-h-dvh transition-[padding] duration-200",
          collapsed ? "lg:pl-[72px]" : "lg:pl-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}
