import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Kenny",
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
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
