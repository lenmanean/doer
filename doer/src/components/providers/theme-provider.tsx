'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSupabase } from './supabase-provider'

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
  orange: '#ea580c',   // orange-600 to match regenerate button
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
  // Initialize from localStorage immediately to prevent flash
  const getInitialTheme = (): Theme => {
    if (initialPreferences?.theme && VALID_THEMES.includes(initialPreferences.theme)) {
      return initialPreferences.theme
    }
    if (typeof window === 'undefined') return defaultTheme
    const saved = localStorage.getItem('theme') as Theme
    return (saved && VALID_THEMES.includes(saved)) ? saved : defaultTheme
  }
  
  const getInitialResolvedTheme = (): 'dark' | 'light' => {
    if (initialPreferences?.theme && VALID_THEMES.includes(initialPreferences.theme)) {
      return resolveThemeValue(initialPreferences.theme)
    }
    if (typeof window === 'undefined') return resolveThemeValue(defaultTheme)
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
    const initialTheme = getInitialTheme()
    const initialResolved = getInitialResolvedTheme()
    const initialAccent = getInitialAccentColor()
    
    // Apply theme classes immediately
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(initialResolved)
    
    const body = document.body
    if (initialResolved === 'light') {
      body.className = 'font-sans antialiased bg-white text-gray-900'
      body.classList.add('light-theme')
      body.classList.remove('dark-theme')
    } else {
      body.className = 'font-sans antialiased bg-[#0a0a0a] text-[#d7d2cb]'
      body.classList.add('dark-theme')
      body.classList.remove('light-theme')
    }
    
    // Apply accent color immediately
    applyAccentColor(initialAccent)
  }, []) // Run only once on mount

  // Load theme and accent color from user preferences
  const loadUserPreferences = async (userId: string | null) => {
    try {
      if (!userId) {
        // No user - clear localStorage and use defaults
        localStorage.removeItem('theme')
        localStorage.removeItem('accentColor')
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
            // Profile doesn't exist - use defaults
            setTheme(defaultTheme)
            setAccentColorState('orange')
            applyAccentColor('orange')
            localStorage.setItem('theme', defaultTheme)
            localStorage.setItem('accentColor', 'orange')
            setIsLoading(false)
            return
          } else {
            // Other error - log and use defaults
            console.error('Error loading user preferences:', profileError)
            setTheme(defaultTheme)
            setAccentColorState('orange')
            applyAccentColor('orange')
            localStorage.setItem('theme', defaultTheme)
            localStorage.setItem('accentColor', 'orange')
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
        // Error loading preferences - use defaults
        console.warn('Error loading preferences, using defaults:', error)
        setTheme(defaultTheme)
        setAccentColorState('orange')
        applyAccentColor('orange')
        localStorage.setItem('theme', defaultTheme)
        localStorage.setItem('accentColor', 'orange')
      }
      
      // Always set loading to false
      setIsLoading(false)
    } catch (error) {
      console.error('Error in loadUserPreferences:', error)
      // On error, use defaults and ensure loading is cleared
      setTheme(defaultTheme)
      setAccentColorState('orange')
      applyAccentColor('orange')
      localStorage.setItem('theme', defaultTheme)
      localStorage.setItem('accentColor', 'orange')
      setIsLoading(false)
    }
  }

  // Load preferences on mount and when user changes
  useEffect(() => {
    // First, check localStorage synchronously to avoid flash
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
      localStorage.setItem('theme', serverTheme)
      localStorage.setItem('accentColor', serverAccent)
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
    user?.id,
    initialPreferences?.userId,
    initialPreferences?.theme,
    initialPreferences?.accentColor,
    defaultTheme,
  ])

  // Update resolved theme based on current theme setting
  useEffect(() => {
    let resolved: 'dark' | 'light' = 'dark'
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      resolved = mediaQuery.matches ? 'dark' : 'light'
    } else {
      resolved = theme
    }
    
    setResolvedTheme(resolved)
    
    // Apply theme to document
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(resolved)
    
    // Update body classes for immediate visual feedback
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
    
    // Reapply accent color when theme changes to ensure it's visible
    applyAccentColor(accentColor)
  }, [theme, accentColor])

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
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    // Save to database if user is logged in
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

  const handleSetAccentColor = (color: AccentColor) => {
    setAccentColorState(color)
    localStorage.setItem('accentColor', color)
    applyAccentColor(color)
    
    // Save to database if user is logged in
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
