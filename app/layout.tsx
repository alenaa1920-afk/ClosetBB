import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { WelcomeGate } from "@/components/welcome/welcome-gate";
import { Toaster } from "@/components/ui/toaster";
import { themeInitScript } from "@/lib/store/theme-store";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mon Amour",
  description: "A wardrobe gathered from everywhere, kept in one place for her.",
  applicationName: "Mon Amour",
  appleWebApp: { capable: true, title: "Mon Amour", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FFF8FB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the palette before first paint so nothing ever flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${playfair.variable} ${inter.variable} font-sans antialiased`}
      >
        <WelcomeGate>{children}</WelcomeGate>
        <Toaster />
      </body>
    </html>
  );
}
