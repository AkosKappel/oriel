import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

/**
 * After a client-side navigation, moves focus to the new page's heading when the focused element
 * went away (a link on a screen that is now hidden), so keyboard and screen reader users are not
 * dropped back at the top of the document. Focus that is still visible, such as a link in the list
 * beside an open item, stays where it is.
 */
export function useFocusAfterNavigation() {
  const router = useRouter()
  useEffect(
    () =>
      router.subscribe('onRendered', ({ fromLocation, pathChanged }) => {
        // The first page load keeps the browser's own starting point.
        if (!fromLocation || !pathChanged) return
        requestAnimationFrame(() => {
          const active = document.activeElement
          if (active && active !== document.body && active.checkVisibility()) {
            return
          }
          // The heading of the main content, or the page heading when it sits above it (home).
          const target =
            document.querySelector<HTMLElement>('[role="main"] h1, main h1') ??
            [...document.querySelectorAll<HTMLElement>('h1')].find((heading) =>
              heading.checkVisibility(),
            ) ??
            document.querySelector<HTMLElement>('[role="main"], main')
          if (!target) return
          if (!target.hasAttribute('tabindex')) target.tabIndex = -1
          target.focus({ preventScroll: true })
        })
      }),
    [router],
  )
}
