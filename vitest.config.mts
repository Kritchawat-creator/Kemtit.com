import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// .mts เพราะ package.json ไม่ได้ตั้ง "type": "module" (Vite โหลด config เป็น ESM)
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
