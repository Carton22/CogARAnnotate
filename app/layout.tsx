import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ??
  "https://dete-reliance-console.polite-mesa-1141.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "CogAR · Wizard of Oz Control Console",
  description:
    "A task-by-task operator console for AI audio cues, final-act timestamps, and reliance classification.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title: "CogAR",
    description: "Wizard of Oz Control Console",
    images: [`${basePath}/og.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "CogAR",
    description: "Wizard of Oz Control Console",
    images: [`${basePath}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
