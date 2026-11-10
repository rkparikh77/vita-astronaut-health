import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { MissionProvider } from "@/lib/store";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"], adjustFontFallback: false });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const data = IBM_Plex_Mono({ variable: "--font-data", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "VITA · Astronaut Health Monitor",
  description:
    "Health monitoring for long-duration space missions. Built on NASA OSDR Inspiration4 clinical data and live DONKI space weather.",
};

export const viewport: Viewport = { themeColor: "#07090d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${data.variable} antialiased`}>
        <MissionProvider>
          <div className="relative z-10">
            <Header />
            <main className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">{children}</main>
          </div>
        </MissionProvider>
      </body>
    </html>
  );
}
