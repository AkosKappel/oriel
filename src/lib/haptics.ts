/** A short buzz on phones that support it (Android Chrome); nothing elsewhere or with reduced motion. */
export function tick() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate?.(10)
}
