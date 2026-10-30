import { createFileRoute } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_notebook/app')({
  component: NothingOpen,
})

/** The reading pane before anything is open; only shown on wide screens. */
function NothingOpen() {
  return (
    // A hint for sighted users; the list beside it already says everything a screen reader needs.
    <p
      aria-hidden
      className="flex flex-1 items-center justify-center pb-24 font-serif text-xl text-muted-foreground italic"
    >
      {m.nothing_open()}
    </p>
  )
}
