import { getLocale, type Locale, locales } from '#/paraglide/runtime.js'

// Dates follow the language: Irish English keeps day-month order ("30 October"), the others use
// their country's conventions.
const formatLocales: Record<Locale, string> = {
  en: 'en-IE',
  hu: 'hu-HU',
  sk: 'sk-SK',
}

/** Each language in its own name, for the choice in Settings and on the public pages. */
export const languages: { locale: Locale; name: string }[] = [
  { locale: 'en', name: 'English' },
  { locale: 'hu', name: 'Magyar' },
  { locale: 'sk', name: 'Slovenčina' },
]

export const formatLocale = (locale: Locale = getLocale()) =>
  formatLocales[locale]

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value)
