import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOGᴰ",
  description: "Physique optimization: training, nutrition, progress and adaptation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
