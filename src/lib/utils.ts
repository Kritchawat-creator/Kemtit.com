/**
 * cn() — รวม class แบบมีเงื่อนไขและแก้ conflict ของ Tailwind
 * ใช้ package `cn` ของ shadcn (drop-in ของ clsx + tailwind-merge) เพราะ shadcn CLI v3 generate `import { cn } from "cn"`
 * โค้ดของเราเรียกผ่าน "@/lib/utils" เพื่อให้เปลี่ยน implementation ได้จุดเดียว
 */
export { cn } from "cn";
