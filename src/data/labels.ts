import { fold } from './organize'

// Labels are stored on the item as a JSON array of strings: they sync and move with it, and the
// item's edit rights cover them, so they need no tables or permission rules of their own.

export const labelLimit = 10
export const labelLength = 30

/** A label as stored: trimmed, inner spaces collapsed, without a leading `#`. Empty if unusable. */
export const cleanLabel = (text: string) =>
  text
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, labelLength)

/** The labels of a stored row, read leniently: anything unexpected reads as no labels. */
export function readLabels(stored: string | null | undefined): string[] {
  if (!stored) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed)
      ? parsed.filter((label): label is string => typeof label === 'string')
      : []
  } catch {
    return []
  }
}

/** Cleaned, without duplicates (case and accents ignored, the first spelling kept), capped. */
export function normalizeLabels(labels: string[]) {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const label of labels.map(cleanLabel)) {
    const key = fold(label)
    if (!label || seen.has(key)) continue
    seen.add(key)
    kept.push(label)
  }
  return kept.slice(0, labelLimit)
}

/** Labels to store: normalized, as a JSON array, or null for none. */
export function storeLabels(labels: string[]) {
  const kept = normalizeLabels(labels)
  return kept.length > 0 ? JSON.stringify(kept) : null
}

export const hasLabel = (stored: string | null, label: string) =>
  readLabels(stored).some((own) => fold(own) === fold(label))

/**
 * Labels used on the given items, most used first, then alphabetically, for suggestions and the
 * filter on home. Spellings that differ only in case or accents count as one.
 */
export function labelsInUse(stored: (string | null)[]) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const labels of stored) {
    for (const label of readLabels(labels)) {
      const key = fold(label)
      const seen = counts.get(key)
      if (seen) seen.count += 1
      else counts.set(key, { label, count: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map(({ label }) => label)
}
