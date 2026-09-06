import { useTranslations } from "next-intl";
import { cn } from "cn";

import { formatPercent } from "@/lib/format";

type Props = {
  /** 0-100 */
  value: number;
  /** ขนาดเป็น px (hero 196 · component sheet 160 · เล็ก 56) */
  size?: number;
  /** ขนาดเล็ก: เส้นหนาขึ้น ไม่มีตัวเลข/ตัว N (ใช้ในรายการ) */
  small?: boolean;
  /** เส้น sweep สี brand-500 ตามเข็ม (Claude Design Tweaks: showSweep) */
  sweep?: boolean;
  label?: string;
  className?: string;
};

const C = 100;
const R = 76;
const TIP_Y = 34;

function polar(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
}

/**
 * Compass Dial (Claude Design 1a): จุดหมาย = N (บน) · เข็มเริ่มทิศใต้ที่ 0% แล้วหมุนตามเข็มนาฬิกาถึง N ที่ 100%
 * หน้าปัดขาว · วงแหวน border · sweep brand-500 · ขีด 8 ทิศ border-strong · ปลายเข็มเพชร accent-500 (จุด accent เดียวบนหน้าปัด)
 * ถึง 100% เข็มล็อก N และปลายเข็ม pulse (ปิดเองเมื่อ prefers-reduced-motion) · ตัวเลข % เป็น HTML ซ้อนกลางเพื่อให้อ่าน/ทดสอบได้
 */
export function CompassDial({
  value,
  size = 196,
  small = false,
  sweep = true,
  label,
  className,
}: Props) {
  const t = useTranslations("a11y");
  const p = Math.max(0, Math.min(100, value));
  const done = p >= 100;
  const angle = 180 + p * 1.8;
  const [sx, sy] = polar(180, R);
  const [ex, ey] = polar(angle, R);
  const ringWidth = small ? 5 : 3;
  const needleWidth = small ? 4 : 2;
  const tipHalf = small ? 9 : 7;

  return (
    <div
      role="progressbar"
      aria-label={label ?? t("progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" className="block size-full overflow-visible" aria-hidden="true">
        <circle cx={C} cy={C} r={98} className="fill-bg-surface" />
        <circle cx={C} cy={C} r={R} fill="none" strokeWidth={ringWidth} className="stroke-border" />
        {sweep && p > 0.5 ? (
          <path
            d={`M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}`}
            fill="none"
            strokeWidth={ringWidth}
            strokeLinecap="round"
            className="stroke-brand-500 transition-[d] duration-700"
          />
        ) : null}
        {Array.from({ length: 7 }, (_, i) => {
          const deg = (i + 1) * 45;
          const [x1, y1] = polar(deg, 86);
          const [x2, y2] = polar(deg, 94);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={small ? 3 : 1.5}
              strokeLinecap="round"
              className="stroke-border-strong"
            />
          );
        })}
        {small ? (
          <line
            x1={C}
            y1={6}
            x2={C}
            y2={14}
            strokeWidth={3}
            strokeLinecap="round"
            className="stroke-brand-800"
          />
        ) : (
          <text
            x={C}
            y={17}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            className="fill-brand-800 font-sans"
          >
            N
          </text>
        )}
        <g
          className="transition-transform duration-[800ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px" }}
        >
          <line
            x1={C}
            y1={158}
            x2={C}
            y2={168}
            strokeWidth={needleWidth}
            strokeLinecap="round"
            className="stroke-brand-200"
          />
          <line
            x1={C}
            y1={44}
            x2={C}
            y2={56}
            strokeWidth={needleWidth}
            strokeLinecap="round"
            className="stroke-brand-800"
          />
          <polygon
            points={`${C},22 ${C + tipHalf},${TIP_Y} ${C},46 ${C - tipHalf},${TIP_Y}`}
            className="fill-accent-500"
          />
          {done ? (
            <circle
              cx={C}
              cy={TIP_Y}
              r={9}
              className="animate-km-pulse fill-accent-500"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ) : null}
        </g>
      </svg>
      {!small ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-display text-text-primary">
          {formatPercent(p / 100)}
        </span>
      ) : null}
    </div>
  );
}
