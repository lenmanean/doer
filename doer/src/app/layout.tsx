import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { validateCoreFeatures } from "@/lib/feature-flags";
import { PageFadeIn } from "@/components/ui/FadeInWrapper";
import { createClient } from '@/lib/supabase/server'
import { SupabaseProvider } from '@/components/providers/supabase-provider'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOER.AI - AI-Powered Goal Achievement Platform",
  description: "Transform your goals into reality with AI-powered roadmaps, milestone tracking, and intelligent planning designed for achievers.",
};

// Validate core features at startup
validateCoreFeatures();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans antialiased text-[#d7d2cb]" style={{ backgroundColor: '#0a0a0a' }}>
        <SupabaseProvider>
          <ToastProvider>
            <PageFadeIn className="min-h-screen">
              {children}
            </PageFadeIn>
          </ToastProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}

