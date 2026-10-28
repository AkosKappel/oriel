/**
 * Title, description and the link preview tags for a route's `head`. The router keeps the
 * deepest route's tag per name, so a page's values replace the root's.
 */
export function pageMeta(
  title: string,
  description: string,
  { indexed = false } = {},
) {
  return [
    { title },
    { name: 'description', content: description },
    // Notes and lists are private: only the public pages belong in search results.
    { name: 'robots', content: indexed ? 'index, follow' : 'noindex' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
  ]
}
