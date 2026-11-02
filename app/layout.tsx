import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WiFi Manager",
  description: "Huawei HG8145C WiFi Device Manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-950 text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
