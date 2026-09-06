"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const PARTICLES = 20;
const DURATION_MS = 800; // Design §11: celebration ครั้งเดียว 800ms ไม่วนซ้ำ
const COLORS = [
  "bg-brand-500",
  "bg-accent-500",
  "bg-success-500",
  "bg-warning-500",
  "bg-brand-300",
];

/** confetti เล็ก ๆ ตอนทำเป้าสำเร็จ 100% — เปลี่ยน `fireKey` เพื่อยิงใหม่; ปิดเมื่อ prefers-reduced-motion */
export function Celebration({ fireKey }: { fireKey: number }) {
  const reduced = useReducedMotion();
  const [dismissedKey, setDismissedKey] = useState(0);
  const active = fireKey > 0 && fireKey !== dismissedKey && !reduced ? fireKey : null;

  useEffect(() => {
    if (!fireKey || reduced) return;
    const id = setTimeout(() => setDismissedKey(fireKey), DURATION_MS);
    return () => clearTimeout(id);
  }, [fireKey, reduced]);

  return (
    <AnimatePresence>
      {active !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        >
          {Array.from({ length: PARTICLES }, (_, i) => {
            const angle = (i / PARTICLES) * Math.PI * 2;
            const distance = 120 + (i % 4) * 30;
            return (
              <motion.span
                key={`${active}-${i}`}
                className={`absolute size-2.5 rounded-full ${COLORS[i % COLORS.length]}`}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance + 40,
                  scale: 0.4,
                  opacity: 0,
                }}
                transition={{ duration: DURATION_MS / 1000, ease: "easeOut" }}
              />
            );
          })}
        </div>
      ) : null}
    </AnimatePresence>
  );
}
