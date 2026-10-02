import type { Metadata } from "next";

import { PrototypeClient } from "./PrototypeClient";

export const metadata: Metadata = {
  title: "Kemtit Design Prototype",
  description: "Isolated visual prototype for comparing Kemtit design-system directions.",
};

export default function PrototypePage() {
  return <PrototypeClient />;
}
