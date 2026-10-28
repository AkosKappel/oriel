import { useSyncExternalStore } from 'react'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

const storageKey = 'oriel.theme'
const listeners = new Set<() => void>()

/**
 * Applies a theme to the page: `data-theme` picks the colour scheme in styles.css, and the
 * browser's own colour (address bar, status bar) follows it. Self-contained, because it also runs
 * as an inline script before the first paint (`themeScript`), so a dark choice never flashes light.
 */
function applyTheme(theme: string | null) {
  const root = document.documentElement
  const colors = { light: '#faf6ef', dark: '#141820' }
  const forced = theme === 'light' || theme === 'dark' ? theme : null
  if (forced) root.dataset.theme = forced
  else delete root.dataset.theme
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = meta.getAttribute('media')?.includes('dark')
      ? 'dark'
      : 'light'
    meta.setAttribute('content', colors[forced ?? scheme])
  }
}

export const themeScript = `try{(${applyTheme})(localStorage.getItem('${storageKey}'))}catch{}`

function read(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(storageKey)
    return themes.find((theme) => theme === stored) ?? 'system'
  } catch {
    return 'system'
  }
}

let current: Theme = read()

export function setTheme(theme: Theme) {
  current = theme
  try {
    if (theme === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, theme)
  } catch {
    // Private windows may refuse storage; the choice then lasts until the page closes.
  }
  applyTheme(theme)
  for (const listener of listeners) listener()
}

export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => 'system' as const,
  )
}
