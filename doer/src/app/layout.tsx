import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { validateCoreFeatures } from "@/lib/feature-flags";
import { PageFadeIn } from "@/components/ui/FadeInWrapper";
import { createClient, validateSession } from '@/lib/supabase/server'
import { SupabaseProvider } from '@/components/providers/supabase-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { getLocale } from '@/i18n/request'
import { LocaleProvider } from '@/components/providers/locale-provider'
import enMessages from '../messages/en.json'

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'UTC'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOER - AI-Powered Goal Achievement Platform",
  description: "Transform your goals into reality with AI-powered roadmaps, milestone tracking, and intelligent planning designed for achievers.",
};

// Validate core features at startup
validateCoreFeatures();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use validateSession to get user - this automatically handles invalid sessions
  let initialUser = null
  try {
    console.error('[layout] Validating session for initial user...')
    initialUser = await validateSession()
    if (initialUser) {
      console.error('[layout] Initial user validated:', initialUser.id)
    } else {
      console.error('[layout] No valid session found')
    }
  } catch (error: any) {
    console.error('[layout] Error validating session:', error)
    // Don't set initialUser if validation fails
    initialUser = null
  }

  // Get locale with error handling
  let locale = 'en'
  let messages = enMessages
  let timeZone = DEFAULT_TIME_ZONE
  try {
    const localeData = await getLocale()
    locale = localeData.locale
    messages = localeData.messages
    timeZone = localeData.timeZone || DEFAULT_TIME_ZONE
  } catch (error) {
    console.error('Error loading locale:', error)
    // Fallback to English messages (already imported)
  }
  
  return (
    <html lang={locale} className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Check if we're on a public page (not dashboard, schedule, settings)
                  const path = window.location.pathname;
                  const isPublicPage = !path.includes('/dashboard') && !path.includes('/schedule') && !path.includes('/settings') && !path.includes('/onboarding');
                  
                  let savedTheme, resolvedTheme;
                  
                  if (isPublicPage) {
                    // Use public theme for public pages
                    savedTheme = localStorage.getItem('publicTheme');
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    resolvedTheme = savedTheme === 'light' ? 'light' : (savedTheme === 'dark' ? 'dark' : (prefersDark ? 'dark' : 'light'));
                  } else {
                    // Use user theme for logged-in pages
                    savedTheme = localStorage.getItem('theme');
                    const savedAccentColor = localStorage.getItem('accentColor');
                    
                    // Theme colors - adjusted to match green's lightness (61.37%)
                    const accentColors = {
                      default: '#949aa5',
                      blue: '#4387f6',
                      green: '#51e889',
                      yellow: '#f7b442',
                      pink: '#ec4d9c',
                      orange: '#ff9c3a',
                      purple: '#7a44f5'
                    };
                    
                    // Determine resolved theme
                    resolvedTheme = 'dark';
                    if (savedTheme === 'light') {
                      resolvedTheme = 'light';
                    } else if (savedTheme === 'system') {
                      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                      resolvedTheme = mediaQuery.matches ? 'dark' : 'light';
                    }
                    
                    // Apply accent color immediately
                    const accentColor = savedAccentColor && accentColors[savedAccentColor] ? accentColors[savedAccentColor] : accentColors.orange;
                    document.documentElement.style.setProperty('--accent-color', accentColor);
                    document.documentElement.style.setProperty('--primary', accentColor);
                    document.documentElement.style.setProperty('--ring', accentColor);
                  }
                  
                  // Apply theme class immediately
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(resolvedTheme);
                  
                  // Apply body classes
                  const body = document.body;
                  if (resolvedTheme === 'light') {
                    body.className = 'font-sans antialiased bg-white text-gray-900';
                    body.classList.add('light-theme');
                    body.classList.remove('dark-theme');
                  } else {
                    body.className = 'font-sans antialiased bg-gray-900 text-[#d7d2cb]';
                    body.classList.add('dark-theme');
                    body.classList.remove('light-theme');
                  }
                } catch (e) {
                  // Fallback to dark theme if there's an error
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <LocaleProvider locale={locale} messages={messages} timeZone={timeZone}>
          <ThemeProvider>
            <SupabaseProvider initialUser={initialUser}>
              <ToastProvider>
                <PageFadeIn className="min-h-screen">
                  {children}
                </PageFadeIn>
              </ToastProvider>
            </SupabaseProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

