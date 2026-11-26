import type { Metadata } from "next";
import "./globals.css";
import { fontFaceCss } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Resume Builder",
  description: "Build a resume and download it as PDF and Word.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
