/**
 * Country code mapping utility
 * Maps country display names to ISO 3166-1 alpha-2 country codes
 * Used for Stripe tax calculation and address formatting
 */

const COUNTRY_CODE_MAP: Record<string, string> = {
  // Countries from checkout dropdown
  'United States': 'US',
  'Canada': 'CA',
  'United Kingdom': 'GB',
  'Australia': 'AU',
  'Germany': 'DE',
  'France': 'FR',
  'Japan': 'JP',
  
  // Common additional countries for future expansion
  'Afghanistan': 'AF',
  'Albania': 'AL',
  'Algeria': 'DZ',
  'Argentina': 'AR',
  'Austria': 'AT',
  'Bangladesh': 'BD',
  'Belgium': 'BE',
  'Brazil': 'BR',
  'Bulgaria': 'BG',
  'Chile': 'CL',
  'China': 'CN',
  'Colombia': 'CO',
  'Croatia': 'HR',
  'Czech Republic': 'CZ',
  'Denmark': 'DK',
  'Egypt': 'EG',
  'Finland': 'FI',
  'Greece': 'GR',
  'Hong Kong': 'HK',
  'Hungary': 'HU',
  'India': 'IN',
  'Indonesia': 'ID',
  'Ireland': 'IE',
  'Israel': 'IL',
  'Italy': 'IT',
  'Malaysia': 'MY',
  'Mexico': 'MX',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Nigeria': 'NG',
  'Norway': 'NO',
  'Pakistan': 'PK',
  'Philippines': 'PH',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Romania': 'RO',
  'Russia': 'RU',
  'Saudi Arabia': 'SA',
  'Singapore': 'SG',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'Spain': 'ES',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Taiwan': 'TW',
  'Thailand': 'TH',
  'Turkey': 'TR',
  'Ukraine': 'UA',
  'United Arab Emirates': 'AE',
  'Vietnam': 'VN',
}

/**
 * Get ISO 3166-1 alpha-2 country code from country display name
 * 
 * @param countryName - Country display name (e.g., "United States")
 * @returns ISO country code (e.g., "US") or null if not found
 * 
 * @example
 * getCountryCode("United States") // Returns "US"
 * getCountryCode("Canada") // Returns "CA"
 * getCountryCode("Other") // Returns null
 */
export function getCountryCode(countryName: string | null | undefined): string | null {
  if (!countryName) {
    return null
  }
  
  // Handle "Other" option - return null to indicate unknown
  if (countryName === 'Other') {
    return null
  }
  
  // Direct lookup (case-sensitive)
  if (COUNTRY_CODE_MAP[countryName]) {
    return COUNTRY_CODE_MAP[countryName]
  }
  
  // Case-insensitive lookup
  const normalizedName = countryName.trim()
  const lowerCaseMap: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(COUNTRY_CODE_MAP)) {
    lowerCaseMap[key.toLowerCase()] = value
  }
  
  const found = lowerCaseMap[normalizedName.toLowerCase()]
  if (found) {
    return found
  }
  
  // Not found
  return null
}

/**
 * Check if a country code is valid
 * 
 * @param countryCode - ISO country code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCountryCode(countryCode: string | null | undefined): boolean {
  if (!countryCode) {
    return false
  }
  
  return Object.values(COUNTRY_CODE_MAP).includes(countryCode.toUpperCase())
}

