import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { store } from '#/data/client'
import { sharedNote } from '#/data/share'
import { text } from '#/lib/search-params'

/** Web Share Target from the PWA manifest: text or a link shared from another app becomes a note. */
export const Route = createFileRoute('/share')({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { title?: string; text?: string; url?: string } => ({
    title: text(search.title),
    text: text(search.text),
    url: text(search.url),
  }),
  component: Share,
})

function Share() {
  const shared = Route.useSearch()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    // Strict Mode runs effects twice in development; one note per share.
    if (started.current) return
    started.current = true
    const note = sharedNote(shared)
    if (!note) {
      void navigate({ to: '/app', replace: true })
      return
    }
    store.createItem(note).then(
      (itemId) =>
        navigate({ to: '/items/$itemId', params: { itemId }, replace: true }),
      (error: unknown) => {
        console.error('Could not save the shared note', error)
        void navigate({ to: '/app', replace: true })
      },
    )
  }, [shared, navigate])

  return null
}
