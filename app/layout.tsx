import type { Metadata } from "next";

import "@/app/globals.css";
import { ensureSQLiteWalMode } from "@/lib/wal";

export const metadata: Metadata = {
  title: "ERP-Rassvet",
  description: "ERP система для НКО Рассвет",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureSQLiteWalMode();

  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
