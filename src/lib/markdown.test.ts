import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings, emphasis, lists and line breaks', () => {
    expect(renderMarkdown('# Trip\n**Pack** *light*\n\n- tent\n- stove')).toBe(
      '<h1>Trip</h1>\n<p><strong>Pack</strong> <em>light</em></p>\n<ul>\n<li>tent</li>\n<li>stove</li>\n</ul>\n',
    )
    expect(renderMarkdown('one\ntwo')).toBe('<p>one<br>\ntwo</p>\n')
  })

  it('escapes HTML instead of passing it through', () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"><script>x</script>',
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('drops script links and opens the others in a new tab', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href')
    expect(renderMarkdown('see https://example.com')).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">',
    )
  })
})
