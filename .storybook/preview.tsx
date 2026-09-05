import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";

import messages from "../src/messages/th.json";
import { plexThai } from "../src/styles/theme";

import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="th" timeZone="Asia/Bangkok" messages={messages}>
        <div lang="th" className={`${plexThai.variable} font-sans text-body text-text-primary`}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};

export default preview;
