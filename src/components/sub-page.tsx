import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

const backLinks = {
  '/': 'Everything',
  '/account': 'Account',
  '/spaces': 'Spaces',
} as const

/** The frame of every page below home: a way back, and content on the notebook column. */
export function SubPage({
  back = '/',
  children,
}: {
  back?: keyof typeof backLinks
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <nav aria-label="Back">
        <Link
          to={back}
          className="-ml-3 flex h-11 w-fit items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {backLinks[back]}
        </Link>
      </nav>
      <main className="flex flex-col gap-8 pt-8 pb-12 pl-10">{children}</main>
    </div>
  )
}
