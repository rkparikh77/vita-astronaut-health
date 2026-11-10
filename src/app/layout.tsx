import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Copilot } from "@/components/Copilot";
import { Header, MobileTabBar } from "@/components/Header";
import { MissionProvider } from "@/lib/store";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"], adjustFontFallback: false });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const data = IBM_Plex_Mono({ variable: "--font-data", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "VITA · Astronaut Health Monitor",
  description:
    "Health monitoring for long-duration space missions. Built on NASA OSDR Inspiration4 clinical data and live DONKI space weather.",
  applicationName: "VITA",
  appleWebApp: { capable: true, title: "VITA", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Older iOS versions only go full-screen from the home screen with Apple's own tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / Dynamic Island; the header and tab bar pad with safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${data.variable} antialiased`}>
        <MissionProvider>
          <div className="relative z-10">
            <Header />
            <main className="mx-auto max-w-[1440px] px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-24">{children}</main>
          </div>
          <MobileTabBar />
          <Copilot />
        </MissionProvider>
      </body>
    </html>
  );
}
