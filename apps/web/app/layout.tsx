import type { Metadata } from "next";
import { DM_Mono, Inter } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "drawxyz — AI Diagram Generator",
  description:
    "Describe it. Get a diagram. Export anywhere. One AI-native canvas, fully editable.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23e85d26'/><text x='16' y='22' font-size='18' text-anchor='middle' fill='white' font-family='monospace' font-weight='bold'>F</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmMono.variable} ${inter.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
