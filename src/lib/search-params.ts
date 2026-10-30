// URL search values are read leniently: anything unexpected reads as unset, so an old or
// hand-edited link still opens the page. Plain checks instead of Zod, because route definitions
// load on every page.

export const oneOf = <T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | undefined => (allowed.includes(value as T) ? (value as T) : undefined)

export const text = (value: unknown, max = 2000) =>
  typeof value === 'string' && value.length <= max ? value : undefined

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const uuid = (value: unknown) =>
  typeof value === 'string' && uuidPattern.test(value) ? value : undefined

/** `?mine=true` arrives as the boolean true (the router parses search values as JSON). */
export const flag = (value: unknown) => (value === true ? true : undefined)
