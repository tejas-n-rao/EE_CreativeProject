import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ThemeToggle from "./ThemeToggle";

export const metadata: Metadata = {
  title: "Carbon Calculator",
  description: "Monorepo scaffold for a carbon calculator"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
