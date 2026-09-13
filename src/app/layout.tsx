import type { Metadata, Viewport } from "next";
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Life RPG — Turn Real Life Into an Epic Quest",
    template: "%s · Life RPG",
  },
  description:
    "Level up your real life. Life RPG turns daily tasks into quests, XP, gold, and streaks in a fully-featured fantasy character system.",
  keywords: [
    "life rpg",
    "gamified productivity",
    "habit tracker",
    "xp system",
    "productivity app",
  ],
  openGraph: {
    title: "Life RPG — Turn Real Life Into an Epic Quest",
    description:
      "Daily tasks become quests. Quests become XP, gold, and legendary streaks.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Life RPG — Turn Real Life Into an Epic Quest",
    description: "Daily tasks become quests. Quests become XP, gold, and streaks.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved shop theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("liferpg-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
