import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Storybook — พัฒนา component แยกจากแอป ดูทุก state (Design §15)
 * DoD: components/domain และ components/widgets ต้องมี story ≥ 3 state
 * alias mock ด้านล่างทำให้ story ของ client component ที่ import server action (เช่น TaskList) render ได้
 */
const config: StorybookConfig = {
  framework: { name: "@storybook/nextjs-vite", options: {} },
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: ["@storybook/addon-docs"],
  staticDirs: ["../public"],
  viteFinal: async (viteConfig) => {
    viteConfig.resolve ??= {};
    const existing = Array.isArray(viteConfig.resolve.alias)
      ? viteConfig.resolve.alias
      : Object.entries(viteConfig.resolve.alias ?? {}).map(([find, replacement]) => ({
          find,
          replacement,
        }));
    viteConfig.resolve.alias = [
      { find: "server-only", replacement: `${here}mocks/server-only.ts` },
      { find: "@/lib/supabase/server", replacement: `${here}mocks/supabase-server.ts` },
      { find: "next/cache", replacement: `${here}mocks/next-cache.ts` },
      { find: "next/headers", replacement: `${here}mocks/next-headers.ts` },
      ...existing,
    ];
    return viteConfig;
  },
};

export default config;
