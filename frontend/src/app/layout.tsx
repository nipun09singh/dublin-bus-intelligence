import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BusIQ — Dublin Bus Intelligence",
  description:
    "Real-time intelligence layer for Dublin's bus network. Predicts, visualises, and optimises the passenger experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-black text-white overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
