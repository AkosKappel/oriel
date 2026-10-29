const browsers: [RegExp, string][] = [
  [/EdgA?\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const systems: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
]

const match = (list: [RegExp, string][], userAgent: string) =>
  list.find(([pattern]) => pattern.test(userAgent))?.[1]

/** "Chrome on Android" from a user agent, enough to tell a person's own devices apart. */
export function describeDevice(userAgent: string | null) {
  if (!userAgent) return 'Unknown device'
  const browser = match(browsers, userAgent)
  const system = match(systems, userAgent)
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? 'Unknown device'
}
