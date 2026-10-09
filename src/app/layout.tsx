import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataVault — Train Together. Share Nothing.",
  description:
    "DataVault is a privacy-first AI collaboration marketplace. Organizations co-train AI models via federated learning without sharing raw data. Research / hackathon demonstration.",
  keywords: [
    "DataVault",
    "federated learning",
    "privacy-preserving AI",
    "secure aggregation",
    "blockchain rewards",
    "DPDP",
  ],
  authors: [{ name: "DataVault" }],
  icons: {
    icon: "/vault.svg",
  },
  openGraph: {
    title: "DataVault — Privacy-First AI Marketplace",
    description:
      "Train AI together. Keep your data. Federated learning + secure aggregation + blockchain-verified rewards.",
    siteName: "DataVault",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a13",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col font-sans dark`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0e1729",
              border: "1px solid #1b2942",
              color: "#e8eef9",
            },
          }}
        />
      </body>
    </html>
  );
}
