import type { Preview } from "@storybook/nextjs-vite";

import { plexThai } from "../src/styles/theme";

import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
  decorators: [
    (Story) => (
      <div lang="th" className={`${plexThai.variable} font-sans text-body text-text-primary`}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
