import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import AppBar from "@/components/AppBar"; // ✅ Import AppBar
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Theme>
          <AppBar /> {/* ✅ AppBar is persistent on all pages */}
          {children}
        </Theme>
      </body>
    </html>
  );
}
