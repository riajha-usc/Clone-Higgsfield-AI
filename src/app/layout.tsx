import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppBootstrap } from "@/components/layout/app-bootstrap";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Afterglow",
  description: "Generate AI images and motion previews, with honest credits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AppBootstrap />
        <TooltipProvider>
          <SiteHeader />
          <main>{children}</main>
          <Toaster theme="dark" />
        </TooltipProvider>
      </body>
    </html>
  );
}
