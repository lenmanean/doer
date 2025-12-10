'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabase } from './supabase-provider'
import { isAuthenticatedRoute, isPublicRoute } from '@/lib/utils/route-utils'

export type Theme = 'dark' | 'light' | 'system'
export type AccentColor = 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export interface InitialThemePreferences {
  userId: string
  theme?: Theme
  accentColor?: AccentColor
}

// Accent color palette - adjusted to match green's lightness (61.37%)
const accentColors: Record<AccentColor, string> = {
  default: '#949aa5', // adjusted to match green lightness
  blue: '#4387f6',     // adjusted to match green lightness
  green: '#51e889',    // lightened from #16a34a (pure green-600, no teal)
  yellow: '#f7b442',   // adjusted to match green lightness
  pink: '#ec4d9c',     // adjusted to match green lightness
  orange: '#ff7f00',   // primary orange color
  purple: '#7a44f5'    // adjusted to match green lightness
}

const VALID_THEMES: Theme[] = ['dark', 'light', 'system']
const VALID_ACCENT_COLORS = Object.keys(accentColors) as AccentColor[]

const resolveThemeValue = (value: Theme): 'dark' | 'light' => {
  if (value === 'light') return 'light'
  if (value === 'system') {
    if (typeof window === 'undefined') {
      return 'dark'
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  }
  return 'dark'
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  initialPreferences,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  initialPreferences?: InitialThemePreferences
}) {
  const { user } = useSupabase()
  const pathname = usePathname()
  
  // Initialize from localStorage immediately to prevent flash
  // Only read from localStorage on authenticated routes to prevent stale data conflicts
  const getInitialTheme = (): Theme => {
    if (initialPreferences?.theme && VALID_THEMES.includes(initialPreferences.theme)) {
      return initialPreferences.theme
    }
    if (typeof window === 'undefined') return defaultTheme
    
    // Only read from localStorage if on authenticated route
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    if (!isAuthenticated) {
      return defaultTheme
    }
    
    const saved = localStorage.getItem('theme') as Theme
    return (saved && VALID_THEMES.includes(saved)) ? saved : defaultTheme
  }
  
  const getInitialResolvedTheme = (): 'dark' | 'light' => {
    if (initialPreferences?.theme && VALID_THEMES.includes(initialPreferences.theme)) {
      return resolveThemeValue(initialPreferences.theme)
    }
    if (typeof window === 'undefined') return resolveThemeValue(defaultTheme)
    
    // Check if we're on a public route using window.location (available immediately)
    // This is critical because pathname from usePathname() might not be available during state initialization
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : (pathname || '')
    const isPublic = isPublicRoute(currentPath)
    
    if (isPublic) {
      // On public routes, check publicTheme in localStorage
      // The layout.tsx script already applied the theme, so we should respect what's already on the document
      // Check what theme is currently applied to avoid conflicts
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 
                          document.documentElement.classList.contains('light') ? 'light' : null
      
      if (currentTheme) {
        // Respect the theme already applied by layout.tsx script
        return currentTheme
      }
      
      // Fallback: check localStorage if script hasn't run yet
      const publicTheme = localStorage.getItem('publicTheme')
      if (publicTheme === 'dark') {
        return 'dark'
      } else if (publicTheme === 'light') {
        return 'light'
      } else {
        // No publicTheme saved, use system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        return systemPrefersDark ? 'dark' : 'light'
      }
    }
    
    // Only read from localStorage if on authenticated route
    const isAuthenticated = isAuthenticatedRoute(currentPath)
    if (!isAuthenticated) {
      return resolveThemeValue(defaultTheme)
    }
    
    const saved = localStorage.getItem('theme') as Theme
    if (saved && VALID_THEMES.includes(saved)) {
      return resolveThemeValue(saved)
    }
    return resolveThemeValue(defaultTheme)
  }
  
  const getInitialAccentColor = (): AccentColor => {
    if (initialPreferences?.accentColor && VALID_ACCENT_COLORS.includes(initialPreferences.accentColor)) {
      return initialPreferences.accentColor
    }
    if (typeof window === 'undefined') return 'orange'
    
    // Only read from localStorage if on authenticated route
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    if (!isAuthenticated) {
      return 'orange'
    }
    
    const saved = localStorage.getItem('accentColor') as AccentColor
    return (saved && VALID_ACCENT_COLORS.includes(saved)) ? saved : 'orange'
  }

  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(getInitialResolvedTheme)
  const [accentColor, setAccentColorState] = useState<AccentColor>(getInitialAccentColor)
  const [isLoading, setIsLoading] = useState(true)

  // Apply accent color CSS variables
  const applyAccentColor = (color: AccentColor) => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const colorValue = accentColors[color]
    // Use setProperty with important flag to ensure it overrides CSS
    root.style.setProperty('--accent-color', colorValue, 'important')
    root.style.setProperty('--primary', colorValue, 'important')
    root.style.setProperty('--ring', colorValue, 'important')
  }

  // Apply initial theme immediately on mount (before any async operations)
  useEffect(() => {
    // Use window.location for immediate pathname access (more reliable than usePathname during mount)
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : (pathname || '')
    const isPublic = isPublicRoute(currentPath)
    
    // On public routes, don't apply theme here - let layout.tsx script and PublicHeader handle it
    // The layout.tsx script already applied the public theme before React hydration
    if (isPublic) {
      // Verify the theme is correctly applied (layout.tsx script should have done this)
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 
                          document.documentElement.classList.contains('light') ? 'light' : null
      
      // If no theme is applied (shouldn't happen, but safety check), apply based on publicTheme
      if (!currentTheme) {
        const publicTheme = localStorage.getItem('publicTheme')
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const resolvedTheme = publicTheme === 'dark' ? 'dark' : 
                             publicTheme === 'light' ? 'light' : 
                             (systemPrefersDark ? 'dark' : 'light')
        
        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(resolvedTheme)
        
        const body = document.body
        if (resolvedTheme === 'light') {
          body.className = 'font-sans antialiased text-gray-900'
          body.classList.add('light-theme')
          body.classList.remove('dark-theme')
        } else {
          body.className = 'font-sans antialiased text-[#d7d2cb]'
          body.classList.add('dark-theme')
          body.classList.remove('light-theme')
        }
      }
      
      // Still apply accent color (use default orange for public pages)
      applyAccentColor('orange')
      return
    }
    
    const initialTheme = getInitialTheme()
    const initialResolved = getInitialResolvedTheme()
    const initialAccent = getInitialAccentColor()
    
    // Apply theme classes immediately (only for authenticated routes)
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(initialResolved)
    
    const body = document.body
    if (initialResolved === 'light') {
      body.className = 'font-sans antialiased text-gray-900'
      body.classList.add('light-theme')
      body.classList.remove('dark-theme')
      body.style.backgroundColor = ''
      body.style.color = ''
    } else {
      body.className = 'font-sans antialiased text-[#d7d2cb]'
      body.classList.add('dark-theme')
      body.classList.remove('light-theme')
      body.style.backgroundColor = ''
      body.style.color = ''
    }
    
    // Apply accent color immediately
    applyAccentColor(initialAccent)
  }, [pathname]) // Re-run when pathname changes to handle route transitions

  // Load theme and accent color from user preferences
  const loadUserPreferences = async (userId: string | null) => {
    try {
      // Only load user preferences on authenticated routes
      const isAuthenticated = isAuthenticatedRoute(pathname || '')
      
      if (!userId || !isAuthenticated) {
        // No user or on public page - clear localStorage and use defaults
        // Don't write to localStorage on public pages to avoid conflicts
        if (isAuthenticated) {
          // Only clear if we're on authenticated route but no user
          localStorage.removeItem('theme')
          localStorage.removeItem('accentColor')
        }
        setTheme(defaultTheme)
        setAccentColorState('orange')
        applyAccentColor('orange')
        setIsLoading(false)
        return
      }

      // Fetch from database to get user-specific preferences with timeout
      let profile: any = null
      let profileError: any = null
      
      try {
        // Set a timeout warning, but don't block the query (increased to 15 seconds)
        const timeoutId = setTimeout(() => {
          console.warn('Theme preferences query taking longer than expected (>15s)')
        }, 15000)

        const result = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', userId)
          .single()

        clearTimeout(timeoutId)
        profile = result.data
        profileError = result.error

        // Handle error - if profile doesn't exist (PGRST116), use defaults
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // Profile doesn't exist - treat as stale session, clear and use defaults
            localStorage.removeItem('theme')
            localStorage.removeItem('accentColor')
            setTheme(defaultTheme)
            setAccentColorState('orange')
            applyAccentColor('orange')
            setIsLoading(false)
            return
          } else {
            // Other error - treat as stale session, clear and use defaults
            console.error('Error loading user preferences (possible stale session):', profileError)
            localStorage.removeItem('theme')
            localStorage.removeItem('accentColor')
            setTheme(defaultTheme)
            setAccentColorState('orange')
            applyAccentColor('orange')
            setIsLoading(false)
            return
          }
        }

        if (profile?.preferences) {
          const prefs = profile.preferences as any
          
          // Load theme from preferences
          if (prefs.theme && ['dark', 'light', 'system'].includes(prefs.theme)) {
            setTheme(prefs.theme)
            localStorage.setItem('theme', prefs.theme)
          } else {
            // Use default theme
            setTheme(defaultTheme)
            localStorage.setItem('theme', defaultTheme)
          }

          // Load accent color from preferences
          if (prefs.accent_color && Object.keys(accentColors).includes(prefs.accent_color)) {
            setAccentColorState(prefs.accent_color)
            applyAccentColor(prefs.accent_color)
            localStorage.setItem('accentColor', prefs.accent_color)
          } else {
            // Use default orange
            setAccentColorState('orange')
            applyAccentColor('orange')
            localStorage.setItem('accentColor', 'orange')
          }
        } else {
          // No preferences found - use defaults
          setTheme(defaultTheme)
          setAccentColorState('orange')
          applyAccentColor('orange')
          localStorage.setItem('theme', defaultTheme)
          localStorage.setItem('accentColor', 'orange')
        }
      } catch (error) {
        // Error loading preferences - treat as stale session, clear and use defaults
        console.warn('Error loading preferences (possible stale session), clearing and using defaults:', error)
        localStorage.removeItem('theme')
        localStorage.removeItem('accentColor')
        setTheme(defaultTheme)
        setAccentColorState('orange')
        applyAccentColor('orange')
      }
      
      // Always set loading to false
      setIsLoading(false)
    } catch (error) {
      console.error('Error in loadUserPreferences:', error)
      // On error, clear localStorage and use defaults
      localStorage.removeItem('theme')
      localStorage.removeItem('accentColor')
      setTheme(defaultTheme)
      setAccentColorState('orange')
      applyAccentColor('orange')
      setIsLoading(false)
    }
  }

  // Cleanup: Clear user theme localStorage when navigating to public pages or logging out
  useEffect(() => {
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    
    // If we're on a public page, clear user theme localStorage to prevent conflicts
    if (!isAuthenticated) {
      localStorage.removeItem('theme')
      localStorage.removeItem('accentColor')
    }
    
    // If user logs out (was authenticated, now null), clear user theme localStorage
    if (!user && isAuthenticated) {
      localStorage.removeItem('theme')
      localStorage.removeItem('accentColor')
    }
  }, [pathname, user])

  // Load preferences on mount and when user changes
  useEffect(() => {
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    
    // Only load user preferences on authenticated routes
    if (!isAuthenticated) {
      // On public pages, don't load or apply user preferences
      setIsLoading(false)
      return
    }
    
    // First, check localStorage synchronously to avoid flash (only on authenticated routes)
    const savedTheme = localStorage.getItem('theme') as Theme
    const savedAccentColor = localStorage.getItem('accentColor') as AccentColor
    
    if (savedTheme && VALID_THEMES.includes(savedTheme)) {
      setTheme(savedTheme)
      // Resolve theme immediately
      const resolved = savedTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : savedTheme
      setResolvedTheme(resolved)
      
      // Apply theme classes immediately
      const root = document.documentElement
      root.classList.remove('dark', 'light')
      root.classList.add(resolved)
      
      const body = document.body
      if (resolved === 'light') {
        body.className = 'font-sans antialiased bg-white text-gray-900'
        body.classList.add('light-theme')
        body.classList.remove('dark-theme')
      } else {
        body.className = 'font-sans antialiased bg-[#0a0a0a] text-[#d7d2cb]'
        body.classList.add('dark-theme')
        body.classList.remove('light-theme')
      }
    }
    
    if (savedAccentColor && VALID_ACCENT_COLORS.includes(savedAccentColor)) {
      setAccentColorState(savedAccentColor)
      applyAccentColor(savedAccentColor)
    } else {
      applyAccentColor('orange')
    }

    const hasServerPreferences = Boolean(initialPreferences?.userId)
    const matchesServerUser = hasServerPreferences && user?.id === initialPreferences?.userId
    const shouldUseServerPreferences =
      hasServerPreferences &&
      (matchesServerUser || user === null)

    if (shouldUseServerPreferences && initialPreferences) {
      const serverTheme = (initialPreferences.theme && VALID_THEMES.includes(initialPreferences.theme))
        ? initialPreferences.theme
        : defaultTheme
      const serverAccent = (initialPreferences.accentColor && VALID_ACCENT_COLORS.includes(initialPreferences.accentColor))
        ? initialPreferences.accentColor
        : 'orange'

      setTheme(serverTheme)
      setAccentColorState(serverAccent)
      // Only write to localStorage on authenticated routes
      if (isAuthenticated) {
        localStorage.setItem('theme', serverTheme)
        localStorage.setItem('accentColor', serverAccent)
      }
      applyAccentColor(serverAccent)
      setIsLoading(false)
      return
    }

    const checkUserAndLoad = async () => {
      // Use user from Supabase provider
      await loadUserPreferences(user?.id || null)
    }

    checkUserAndLoad()
  }, [
    pathname,
    user?.id,
    initialPreferences?.userId,
    initialPreferences?.theme,
    initialPreferences?.accentColor,
    defaultTheme,
  ])

  // Update resolved theme based on current theme setting
  useEffect(() => {
    const isPublic = isPublicRoute(pathname || '')
    
    // On public routes, don't apply theme here - let PublicHeader handle it
    if (isPublic) {
      // Still apply accent color (use default orange for public pages)
      applyAccentColor('orange')
      return
    }
    
    let resolved: 'dark' | 'light' = 'dark'
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      resolved = mediaQuery.matches ? 'dark' : 'light'
    } else {
      resolved = theme
    }
    
    setResolvedTheme(resolved)
    
    // Apply theme to document (only for authenticated routes)
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(resolved)
    
    // Update body classes for immediate visual feedback
    const body = document.body
    if (resolved === 'light') {
      body.className = 'font-sans antialiased text-gray-900'
      body.classList.add('light-theme')
      body.classList.remove('dark-theme')
      body.style.backgroundColor = ''
      body.style.color = ''
    } else {
      body.className = 'font-sans antialiased text-[#d7d2cb]'
      body.classList.add('dark-theme')
      body.classList.remove('light-theme')
      body.style.backgroundColor = ''
      body.style.color = ''
    }
    
    // Reapply accent color when theme changes to ensure it's visible
    applyAccentColor(accentColor)
  }, [theme, accentColor, pathname])

  // Handle system theme changes
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        const systemPrefersDark = mediaQuery.matches
        const newResolved = systemPrefersDark ? 'dark' : 'light'
        setResolvedTheme(newResolved)
        
        // Update body classes
        const root = document.documentElement
        root.classList.remove('dark', 'light')
        root.classList.add(newResolved)
        
        const body = document.body
        if (newResolved === 'light') {
          body.className = 'font-sans antialiased bg-white text-gray-900'
          body.classList.add('light-theme')
          body.classList.remove('dark-theme')
        } else {
          body.className = 'font-sans antialiased bg-[#0a0a0a] text-[#d7d2cb]'
          body.classList.add('dark-theme')
          body.classList.remove('light-theme')
        }
      }
      
      // Set initial resolved theme
      handleChange()
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Apply accent color when it changes or when theme changes
  // This ensures accent color is properly applied in both light and dark modes
  useEffect(() => {
    if (!isLoading) {
      applyAccentColor(accentColor)
    }
  }, [accentColor, isLoading, resolvedTheme])

  const handleSetTheme = (newTheme: Theme) => {
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    
    setTheme(newTheme)
    
    // Only write to localStorage on authenticated routes
    if (isAuthenticated) {
      localStorage.setItem('theme', newTheme)
    }
    
    // Save to database if user is logged in and on authenticated route
    if (isAuthenticated) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          try {
            const { data: profile } = await supabase
              .from('user_settings')
              .select('preferences')
              .eq('user_id', user.id)
              .single()
            
            const currentPrefs = (profile?.preferences || {}) as any
            await supabase
              .from('user_settings')
              .upsert({
                user_id: user.id,
                preferences: { ...currentPrefs, theme: newTheme },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              })
          } catch (error) {
            console.error('Error saving theme:', error)
          }
        }
      })
    }
  }

  const handleSetAccentColor = (color: AccentColor) => {
    const isAuthenticated = isAuthenticatedRoute(pathname || '')
    
    setAccentColorState(color)
    applyAccentColor(color)
    
    // Only write to localStorage on authenticated routes
    if (isAuthenticated) {
      localStorage.setItem('accentColor', color)
    }
    
    // Save to database if user is logged in and on authenticated route
    if (isAuthenticated) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          try {
            const { data: profile } = await supabase
              .from('user_settings')
              .select('preferences')
              .eq('user_id', user.id)
              .single()
            
            const currentPrefs = (profile?.preferences || {}) as any
            await supabase
              .from('user_settings')
              .upsert({
                user_id: user.id,
                preferences: { ...currentPrefs, accent_color: color },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              })
          } catch (error) {
            console.error('Error saving accent color:', error)
          }
        }
      })
    }
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme: handleSetTheme, 
      resolvedTheme,
      accentColor,
      setAccentColor: handleSetAccentColor
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
