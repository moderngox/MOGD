import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOGᴰ Admin",
  description: "Dashboard, Users, Exercises, Media, Programs and AI Runs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
