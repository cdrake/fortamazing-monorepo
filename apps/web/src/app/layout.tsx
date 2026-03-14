import { Space_Grotesk } from "next/font/google";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import AppBar from "@/components/AppBar";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={spaceGrotesk.className}>
        <Theme>
          <AppBar />
          {children}
        </Theme>
      </body>
    </html>
  );
}
