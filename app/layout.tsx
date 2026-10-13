import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kabar Barat | Berita Aceh Barat",
  description: "Agregator berita terbaru dari Pemerintah Kabupaten Aceh Barat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}