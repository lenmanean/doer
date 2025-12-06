'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Languages, ChevronDown, Menu, X, Sun, Moon, User, LogOut } from 'lucide-react'
import { Button } from './Button'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'

export function PublicHeader() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const { user, supabase, loading, sessionReady } = useSupabase()

  const isClientRoute = Boolean(
    pathname &&
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/schedule'))
  )
  const isAuthenticated = Boolean(user && sessionReady && !loading)
  const showAuthedCta = Boolean(isAuthenticated && isClientRoute)
  const [productOpen, setProductOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<Locale>('en')
  const [isDark, setIsDark] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [userProfile, setUserProfile] = useState<{ first_name?: string; username?: string } | null>(null)

  const productRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const solutionsRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Get locale from cookie and theme from localStorage on mount
  useEffect(() => {
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1] as Locale
    
    if (cookieLocale && locales.includes(cookieLocale)) {
      setCurrentLocale(cookieLocale)
    }

    // Get public theme preference
    const savedTheme = localStorage.getItem('publicTheme')
    const prefersDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(prefersDark)
    applyPublicTheme(prefersDark)
  }, [])

  // Apply theme to document
  const applyPublicTheme = (dark: boolean) => {
    const root = document.documentElement
    const body = document.body
    
    if (dark) {
      root.classList.add('dark')
      root.classList.remove('light')
      body.className = 'font-sans antialiased bg-gray-900 text-[#d7d2cb]'
      body.classList.add('dark-theme')
      body.classList.remove('light-theme')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      body.className = 'font-sans antialiased bg-white text-gray-900'
      body.classList.add('light-theme')
      body.classList.remove('dark-theme')
    }
  }

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem('publicTheme', newTheme ? 'dark' : 'light')
    applyPublicTheme(newTheme)
  }

  // Set locale cookie and reload
  const handleLocaleChange = (locale: Locale) => {
    document.cookie = `locale=${locale}; path=/; max-age=31536000` // 1 year
    setCurrentLocale(locale)
    setLangOpen(false)
    router.refresh()
  }

  // Fetch user profile from user_settings table
  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated || !user || !supabase) {
        setUserProfile(null)
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_settings')
          .select('first_name, username')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          // PGRST116 means no rows found, which is fine
          console.error('Error fetching user profile:', error)
          setUserProfile(null)
        } else {
          setUserProfile(profile || null)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        setUserProfile(null)
      }
    }

    fetchProfile()
  }, [user, supabase, isAuthenticated])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setProductOpen(false)
      }
      if (resourcesRef.current && !resourcesRef.current.contains(event.target as Node)) {
        setResourcesOpen(false)
      }
      if (solutionsRef.current && !solutionsRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false)
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Determine display name: prefer first_name, then username, then email prefix, then 'User'
  const displayName = userProfile?.first_name || 
                      userProfile?.username || 
                      user?.user_metadata?.full_name || 
                      user?.email?.split('@')[0] || 
                      'User'
  const userInitial = displayName.charAt(0).toUpperCase() || 'U'

  const handleSignOut = async (e?: React.MouseEvent) => {
    // Prevent multiple simultaneous sign out calls
    if (isSigningOut) {
      console.log('[PublicHeader] Sign out already in progress, ignoring...')
      return
    }

    // Prevent event propagation
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    try {
      setIsSigningOut(true)
      console.log('[PublicHeader] Starting sign out...')
      setProfileOpen(false)
      
      // Add timeout to prevent hanging
      const signOutPromise = signOutClient(supabase)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out timeout')), 10000)
      )
      
      await Promise.race([signOutPromise, timeoutPromise])
      
      console.log('[PublicHeader] Sign out successful, redirecting...')
      // Force a hard reload to clear any cached auth state
      // Using window.location.href ensures a full page reload and clears all state
      window.location.href = '/'
    } catch (error) {
      console.error('[PublicHeader] Error signing out:', error)
      setIsSigningOut(false)
      // Even if sign out fails, try to clear local state and redirect after a delay
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    }
  }

  return (
    <header className="w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 px-4 sm:px-6 lg:px-8 py-4 z-50 sticky top-0 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <span className="text-xl font-bold text-gray-900 dark:text-white">DOER</span>
        </Link>

        {/* Desktop Navigation - Absolutely Centered */}
        <nav className="hidden md:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
          {/* Product Dropdown */}
          <div
            ref={productRef}
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button className="flex items-center text-gray-700 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-500 transition-colors">
              {t('header.product')}
              <ChevronDown className="ml-1 w-4 h-4" />
            </button>
            {productOpen && (
              <div className="absolute top-full left-0 pt-2 w-48">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2">
                <Link
                  href="/features"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.features')}
                </Link>
                {/* Pricing link hidden until launch */}
                {!IS_PRE_LAUNCH && (
                  <Link
                    href="/pricing"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('header.pricing')}
                  </Link>
                )}
                <Link
                  href="/features/integrations"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.integrations')}
                </Link>
                <Link
                  href="/changelog"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.changelog')}
                </Link>
                </div>
              </div>
            )}
          </div>

          {/* Resources Dropdown */}
          <div
            ref={resourcesRef}
            className="relative"
            onMouseEnter={() => setResourcesOpen(true)}
            onMouseLeave={() => setResourcesOpen(false)}
          >
            <button className="flex items-center text-gray-700 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-500 transition-colors">
              {t('header.resources')}
              <ChevronDown className="ml-1 w-4 h-4" />
            </button>
            {resourcesOpen && (
              <div className="absolute top-full left-0 pt-2 w-48">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2">
                <Link
                  href="/documentation"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.documentation')}
                </Link>
                <a
                  href="https://discord.gg/JfPXMjCzbN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.community')}
                </a>
                <Link
                  href="/blog"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.blog')}
                </Link>
                </div>
              </div>
            )}
          </div>

          {/* Solutions Dropdown */}
          <div
            ref={solutionsRef}
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
          >
            <button className="flex items-center text-gray-700 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-500 transition-colors">
              {t('header.solutions')}
              <ChevronDown className="ml-1 w-4 h-4" />
            </button>
            {solutionsOpen && (
              <div className="absolute top-full left-0 pt-2 w-56">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2">
                <Link
                  href="/solutions/teams"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.forTeams')}
                </Link>
                <Link
                  href="/solutions/coaches"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.forCoaches')}
                </Link>
                <Link
                  href="/solutions/educators"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700 transition-colors"
                >
                  {t('header.forEducators')}
                </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right side - Language selector, Theme toggle, and CTA */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Language Selector */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="p-2 rounded-lg text-gray-700 hover:text-orange-500 hover:bg-orange-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              aria-label="Select language"
            >
              <Languages className="w-5 h-5" />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => handleLocaleChange(locale)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      currentLocale === locale
                        ? 'bg-orange-500 text-white dark:bg-gray-700 dark:text-white font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-orange-500 hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    {localeNames[locale]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CTA Button */}
          {!isAuthenticated ? (
            <div className="hidden md:flex items-center space-x-3">
              {IS_PRE_LAUNCH ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    trackClick
                    trackId="header-join-waitlist"
                    trackLocation="header"
                    onClick={(e) => {
                      e.preventDefault()
                      // Dispatch custom event to open waitlist modal
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('openWaitlistModal', { detail: { goal: '' } }))
                      }
                    }}
                  >
                    Join Waitlist
                  </Button>
                  <Link href="/login">
                    <Button variant="outline" size="sm" trackClick trackId="header-login" trackLocation="header">{t('common.logIn')}</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup">
                    <Button variant="primary" size="sm" trackClick trackId="header-get-started" trackLocation="header">Get Started</Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="sm" trackClick trackId="header-login" trackLocation="header">{t('common.logIn')}</Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              {showAuthedCta && (
                <Link href="/dashboard" className="hidden md:block">
                  <Button variant="primary" size="sm" trackClick trackId="header-start-planning" trackLocation="header">{t('common.startPlanning')}</Button>
                </Link>
              )}
              <div ref={profileRef} className="relative hidden md:block">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-semibold">
                    {userInitial}
                  </div>
                  <span className="max-w-[120px] truncate">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 z-50">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Account
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="h-4 w-4" />
                      {isSigningOut ? 'Signing out...' : 'Sign Out'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-2 pt-4">
            <div className="px-4 py-2">
              <div className="font-medium text-gray-900 dark:text-white mb-2">{t('header.product')}</div>
              <div className="flex flex-col space-y-1 ml-4">
                <Link href="/features" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.features')}</Link>
                {/* Pricing link hidden until launch */}
                {!IS_PRE_LAUNCH && (
                  <Link href="/pricing" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.pricing')}</Link>
                )}
                <Link href="/features/integrations" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.integrations')}</Link>
                <Link href="/changelog" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.changelog')}</Link>
              </div>
            </div>
            <div className="px-4 py-2">
              <div className="font-medium text-gray-900 dark:text-white mb-2">{t('header.resources')}</div>
              <div className="flex flex-col space-y-1 ml-4">
                <Link href="/documentation" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.documentation')}</Link>
                <a href="https://discord.gg/JfPXMjCzbN" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.community')}</a>
                <Link href="/blog" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.blog')}</Link>
              </div>
            </div>
            <div className="px-4 py-2">
              <div className="font-medium text-gray-900 dark:text-white mb-2">{t('header.solutions')}</div>
              <div className="flex flex-col space-y-1 ml-4">
                <Link href="/solutions/teams" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.forTeams')}</Link>
                <Link href="/solutions/coaches" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.forCoaches')}</Link>
                <Link href="/solutions/educators" className="text-sm text-gray-700 dark:text-gray-300 py-1">{t('header.forEducators')}</Link>
              </div>
            </div>
            {!user ? (
              <div className="flex flex-col space-y-2 px-4 pt-4">
                {IS_PRE_LAUNCH ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault()
                        setMobileMenuOpen(false)
                        // Dispatch custom event to open waitlist modal
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('openWaitlistModal', { detail: { goal: '' } }))
                        }
                      }}
                    >
                      Join Waitlist
                    </Button>
                    <Link href="/login">
                      <Button variant="outline" size="sm" className="w-full">{t('common.logIn')}</Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/auth/signup">
                      <Button variant="primary" size="sm" className="w-full">Get Started</Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="outline" size="sm" className="w-full">{t('common.logIn')}</Button>
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-2 px-4 pt-4">
                {showAuthedCta && (
                  <Link href="/dashboard">
                    <Button variant="primary" size="sm" className="w-full">{t('common.startPlanning')}</Button>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

