import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Red Batch — Product-Safety Containment",
  description:
    "Red Batch turns one bad-batch safety signal into a governed, human-approved stop-ship with a saved Stop-Ship Packet. Built on the UiPath Maestro Case shape.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
