import type { Metadata } from "next";
import "./globals.css";
import AppShell from "./_components/app-shell";

export const metadata: Metadata = {
  title: "fastrak — Project Kenny",
  description: "Web rebuild of Kennard's fastrak distribution system"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
