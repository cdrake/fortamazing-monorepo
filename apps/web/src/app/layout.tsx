import { Geist, Geist_Mono } from "next/font/google";
import AppBar from "@/components/AppBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fort Amazing", // ✅ Set the new title
  description: "Welcome to Fort Amazing – The best place to share and explore fitness content!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Fort Amazing</title>
        {/* ✅ Allow pop-ups by changing Cross-Origin-Opener-Policy */}
        <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin-allow-popups" />
        <meta httpEquiv="Cross-Origin-Embedder-Policy" content="credentialless" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppBar /> {/* ✅ Add the App Bar to all pages */}
        {children}
      </body>
    </html>
  );
}
