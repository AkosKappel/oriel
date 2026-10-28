import MarkdownIt from 'markdown-it'

// Notes are written by any member of a space, so the renderer must never pass HTML through:
// `html: false` escapes it, and markdown-it refuses javascript:, vbscript: and file: links.
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Links leave the app in a new tab and do not tell the target where they came from.
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, index, options)
}

/** A note's Markdown as safe HTML. */
export const renderMarkdown = (text: string) => markdown.render(text)
