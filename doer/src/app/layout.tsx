import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { validateCoreFeatures } from "@/lib/feature-flags";
import { PageFadeIn } from "@/components/ui/FadeInWrapper";
import { createClient, validateSession } from '@/lib/supabase/server'
import { SupabaseProvider } from '@/components/providers/supabase-provider'
import { ThemeProvider, type InitialThemePreferences } from '@/components/providers/theme-provider'
import { TimezoneProvider } from '@/components/providers/timezone-provider'
import { getLocale } from '@/i18n/request'
import { LocaleProvider } from '@/components/providers/locale-provider'
import { AnalyticsInitializer } from '@/components/analytics/AnalyticsInitializer'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import enMessages from '../messages/en.json'

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'UTC'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOER - AI-Powered Goal Achievement Platform",
  description: "Transform your goals into reality with AI-powered plans, progress tracking, and intelligent planning designed for achievers.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// Force dynamic rendering since we use cookies for auth and locale
export const dynamic = 'force-dynamic'

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
    initialUser = await validateSession()
    // Only log if user is found (to reduce noise in logs for public pages)
    if (initialUser) {
      console.log('[layout] Initial user validated:', initialUser.id)
    }
  } catch (error: any) {
    // Only log actual errors, not missing sessions
    if (!error?.message?.includes('session') && !error?.message?.includes('Auth session missing')) {
      console.error('[layout] Error validating session:', error)
    }
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
    
    // Log successful locale loading - use error to ensure visibility in Vercel
    console.error('🚨 [SERVER] [Layout] Locale loaded successfully:', {
      locale,
      hasMessages: !!messages,
      messageKeys: messages ? Object.keys(messages).slice(0, 10) : [],
      timeZone,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Layout] Error loading locale:', error)
    // Log detailed error for debugging
    console.error('[Layout] Locale error details:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      fallbackLocale: locale,
      fallbackMessages: !!enMessages,
    })
    // Fallback to English messages (already imported)
  }
  
  // Log messages structure for debugging - use error to ensure visibility
  if (!messages || typeof messages !== 'object') {
    console.error('🚨 [SERVER] [Layout] Invalid messages object:', {
      messagesType: typeof messages,
      messagesIsNull: messages === null,
      messagesIsUndefined: messages === undefined,
      usingFallback: true,
    })
  } else {
    // Log that messages are valid - use error to ensure visibility
    const hasBlogMessages = 'blog' in messages && typeof (messages as any).blog === 'object'
    console.error('🚨 [SERVER] [Layout] Messages validation:', {
      hasMessages: true,
      hasBlogMessages,
      blogKeys: hasBlogMessages ? Object.keys((messages as any).blog || {}).slice(0, 5) : [],
      locale: locale,
      timestamp: new Date().toISOString()
    })
  }

  let initialPreferences: InitialThemePreferences | undefined
  if (initialUser) {
    try {
      const supabaseClient = await createClient()
      const { data, error } = await supabaseClient
        .from('user_settings')
        .select('preferences')
        .eq('user_id', initialUser.id)
        .single()

      if (!error || error.code === 'PGRST116') {
        const prefs = data?.preferences
        initialPreferences = {
          userId: initialUser.id,
          theme: prefs?.theme,
          accentColor: prefs?.accent_color,
        }
      } else {
        console.error('[layout] Error loading user preferences:', error)
      }
    } catch (error) {
      console.error('[layout] Error loading user preferences:', error)
    }
  }
  
  // Determine if user is authenticated for script
  const isAuthenticated = Boolean(initialUser)
  
  // CRITICAL: Add 'dark' class directly to HTML element by default
  // This ensures dark mode is applied BEFORE any JavaScript runs
  // Only authenticated users on authenticated routes will have it removed by ThemeProvider
  // For public pages, this guarantees dark mode from the start
  const htmlClassName = `${inter.variable} dark`
  
  return (
    <html 
      lang={locale} 
      className={htmlClassName}
      suppressHydrationWarning
      data-is-authenticated={isAuthenticated ? 'true' : 'false'}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Client-side logging utility (runs before React)
                function logToServer(level, message, data) {
                  try {
                    fetch('/api/log', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        level: level,
                        message: message,
                        data: data || {},
                        userAgent: navigator.userAgent,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                      }),
                      keepalive: true
                    }).catch(function() { /* Silently fail */ });
                  } catch(e) { /* Silently fail */ }
                }
                
                // Immediate test log to verify logging works - use error level for visibility
                logToServer('error', '🚨 THEME SCRIPT STARTED - MOBILE DEBUG TEST', {
                  path: window.location.pathname,
                  readyState: document.readyState,
                  userAgent: navigator.userAgent.substring(0, 200),
                  screenWidth: window.screen.width,
                  screenHeight: window.screen.height,
                  viewportWidth: window.innerWidth,
                  viewportHeight: window.innerHeight,
                  isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
                  timestamp: new Date().toISOString()
                });
                
                try {
                  // Check if we're on a public page
                  // Match AUTHENTICATED_ROUTES from route-utils.ts
                  const path = window.location.pathname;
                  const authenticatedRoutes = [
                    '/dashboard',
                    '/schedule',
                    '/settings',
                    '/onboarding',
                    '/analytics',
                    '/data',
                    '/internal',
                    '/test',
                    '/integrations',
                    // '/community', // Temporarily disabled until multi-user functionality is implemented
                    '/help'
                  ];
                  const isAuthenticatedRoute = authenticatedRoutes.some(route => path.startsWith(route));
                  
                  // Check authentication state from data attribute (server-rendered)
                  const htmlElement = document.documentElement;
                  const serverAuthState = htmlElement.getAttribute('data-is-authenticated') === 'true';
                  
                  // Determine if this is truly a public page
                  // Must be: not an authenticated route AND not authenticated
                  const isPublicPage = !isAuthenticatedRoute && !serverAuthState;
                  
                  logToServer('info', 'Theme script initialized', {
                    path: path,
                    isAuthenticatedRoute: isAuthenticatedRoute,
                    serverAuthState: serverAuthState,
                    isPublicPage: isPublicPage,
                    userAgent: navigator.userAgent.substring(0, 100)
                  });
                  
                  // AGGRESSIVE CLEANUP: Clear ALL stale theme data from localStorage on EVERY site visit
                  // This ensures mobile devices don't have any cached theme preferences
                  // ALWAYS clear publicTheme (we removed public theme implementation)
                  localStorage.removeItem('publicTheme');
                  sessionStorage.removeItem('publicTheme');
                  
                  // On public pages, also clear user theme keys (they shouldn't exist on public pages)
                  // This handles cases where users had accounts before and deleted them
                  if (isPublicPage) {
                    const oldTheme = localStorage.getItem('theme');
                    const oldAccentColor = localStorage.getItem('accentColor');
                    if (oldTheme || oldAccentColor) {
                      console.log('[Theme] Removing stale user theme data from localStorage on public page:', { theme: oldTheme, accentColor: oldAccentColor });
                      localStorage.removeItem('theme');
                      localStorage.removeItem('accentColor');
                      sessionStorage.removeItem('theme');
                      sessionStorage.removeItem('accentColor');
                    }
                  }
                  
                  let savedTheme, resolvedTheme;
                  
                  if (isPublicPage) {
                    // Public pages always use dark theme - NO EXCEPTIONS
                    resolvedTheme = 'dark';
                    
                    // AGGRESSIVE: Use inline style as backup to ensure dark mode
                    htmlElement.style.colorScheme = 'dark';
                    
                    logToServer('info', 'Public page theme resolved', {
                      resolvedTheme: resolvedTheme,
                      path: path
                    });
                  } else {
                    // Use user theme for authenticated routes with valid authentication
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
                  
                  // Apply theme class immediately to html element
                  htmlElement.classList.remove('dark', 'light');
                  htmlElement.classList.add(resolvedTheme);
                  
                  logToServer('info', 'Theme class applied', {
                    resolvedTheme: resolvedTheme,
                    isPublicPage: isPublicPage,
                    hasDarkClass: htmlElement.classList.contains('dark'),
                    hasLightClass: htmlElement.classList.contains('light')
                  });
                  
                  // For public pages, be EXTREMELY aggressive about maintaining dark mode
                  if (isPublicPage) {
                    // Use inline style as additional safeguard
                    htmlElement.style.setProperty('color-scheme', 'dark', 'important');
                    
                    // MutationObserver to prevent dark class from being removed
                    const observer = new MutationObserver(function(mutations) {
                      mutations.forEach(function(mutation) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                          const target = mutation.target;
                          if (target === htmlElement && !htmlElement.classList.contains('dark')) {
                            // Dark class was removed - force it back immediately
                            htmlElement.classList.remove('light');
                            htmlElement.classList.add('dark');
                            htmlElement.style.setProperty('color-scheme', 'dark', 'important');
                            logToServer('warn', 'Dark class was removed from public page - forcing it back', {
                              path: path,
                              currentClasses: Array.from(htmlElement.classList)
                            });
                          }
                        }
                      });
                    });
                    
                    // Start observing
                    observer.observe(htmlElement, {
                      attributes: true,
                      attributeFilter: ['class']
                    });
                    
                    // Also check periodically (defensive)
                    setInterval(function() {
                      if (isPublicPage && !htmlElement.classList.contains('dark')) {
                        htmlElement.classList.remove('light');
                        htmlElement.classList.add('dark');
                        htmlElement.style.setProperty('color-scheme', 'dark', 'important');
                        logToServer('warn', 'Periodic check: Dark class missing on public page - forcing it back', {
                          path: path,
                          currentClasses: Array.from(htmlElement.classList)
                        });
                      }
                    }, 1000);
                  }
                  
                  // Function to apply body classes (body might not exist yet)
                  const applyBodyTheme = function() {
                  const body = document.body;
                    if (!body) {
                      // Body doesn't exist yet, wait for DOMContentLoaded
                      if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', applyBodyTheme);
                        return;
                      }
                    }
                    
                  if (resolvedTheme === 'light') {
                      body.className = 'font-sans antialiased text-gray-900';
                    body.classList.add('light-theme');
                    body.classList.remove('dark-theme');
                      body.style.backgroundColor = '';
                      body.style.color = '';
                  } else {
                      body.className = 'font-sans antialiased text-[#d7d2cb]';
                    body.classList.add('dark-theme');
                    body.classList.remove('light-theme');
                      body.style.backgroundColor = '';
                      body.style.color = '';
                    }
                    
                    // For public pages, be extra aggressive
                    if (isPublicPage) {
                      body.classList.remove('light-theme');
                      body.classList.add('dark-theme');
                      body.style.setProperty('color-scheme', 'dark', 'important');
                    }
                    
                    logToServer('info', 'Body theme applied', {
                      resolvedTheme: resolvedTheme,
                      bodyClasses: body.className,
                      isPublicPage: isPublicPage,
                      hasDarkTheme: body.classList.contains('dark-theme'),
                      hasLightTheme: body.classList.contains('light-theme')
                    });
                  };
                  
                  // Try to apply immediately, or wait for body to exist
                  applyBodyTheme();
                  
                  // Also ensure theme is applied after a short delay (for mobile browsers that might delay body creation)
                  setTimeout(function() {
                    if (isPublicPage) {
                      htmlElement.classList.remove('dark', 'light');
                      htmlElement.classList.add('dark');
                      htmlElement.style.setProperty('color-scheme', 'dark', 'important');
                    } else {
                      htmlElement.classList.remove('dark', 'light');
                      htmlElement.classList.add(resolvedTheme);
                    }
                    applyBodyTheme();
                  }, 0);
                  
                  // Additional delay for mobile (some browsers are slower)
                  setTimeout(function() {
                    if (isPublicPage) {
                      htmlElement.classList.remove('dark', 'light');
                      htmlElement.classList.add('dark');
                      htmlElement.style.setProperty('color-scheme', 'dark', 'important');
                      applyBodyTheme();
                    }
                  }, 100);
                  
                } catch (e) {
                  logToServer('error', 'Theme script error', {
                    error: e instanceof Error ? e.message : String(e),
                    stack: e instanceof Error ? e.stack : undefined,
                    path: window.location.pathname
                  });
                  // Fallback to dark theme if there's an error
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add('dark');
                  if (document.body) {
                    document.body.classList.add('dark-theme');
                    document.body.classList.remove('light-theme');
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AnalyticsScripts />
        <LocaleProvider locale={locale} messages={messages} timeZone={timeZone}>
          <SupabaseProvider initialUser={initialUser}>
            <ThemeProvider initialPreferences={initialPreferences}>
              <TimezoneProvider>
                <ToastProvider>
                  <AnalyticsInitializer />
                  <PageFadeIn className="min-h-screen">
                    {children}
                  </PageFadeIn>
                </ToastProvider>
              </TimezoneProvider>
            </ThemeProvider>
          </SupabaseProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

