import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";


export const metadata: Metadata = {
  metadataBase: new URL("https://armsconnect.vercel.app"),
  title: {
    default: "ARMS Portal - Student Dashboard",
    template: "%s | ARMS Portal",
  },
  description: "Experience the next generation of student portals with real-time academic analytics.",
  applicationName: "ARMS Portal",
  keywords: [
    "student portal",
    "college dashboard",
    "attendance tracker",
    "academic analytics",
    "student profile",
    "ARMS Portal",
  ],
  alternates: {
    canonical: "https://armsconnect.vercel.app/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "ARMS Portal - Student Dashboard",
    description: "Experience the next generation of student portals with real-time academic analytics.",
    url: "https://armsconnect.vercel.app/",
    siteName: "ARMS Portal",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARMS Portal - Student Dashboard",
    description: "Experience the next generation of student portals with real-time academic analytics.",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090d16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
      </head>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
