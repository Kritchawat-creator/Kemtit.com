import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Storybook — พัฒนา component แยกจากแอป ดูทุก state (Design §15)
 * DoD: components/domain และ components/widgets ต้องมี story ≥ 3 state
 */
const config: StorybookConfig = {
  framework: { name: "@storybook/nextjs-vite", options: {} },
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: ["@storybook/addon-docs"],
  staticDirs: ["../public"],
};

export default config;
