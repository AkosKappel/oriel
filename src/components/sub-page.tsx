import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { AppHeader } from '#/components/app-header'

const backLinks = {
  '/app': 'Everything',
  '/account': 'Account',
  '/spaces': 'Spaces',
} as const

/** The frame of every app page beside the notebook: the header on wide screens, a way back, and content on the notebook column. */
export function SubPage({
  back = '/app',
  children,
}: {
  back?: keyof typeof backLinks
  children: ReactNode
}) {
  return (
    <>
      <AppHeader />
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] lg:min-h-0 lg:max-w-2xl lg:pt-6">
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
    </>
  )
}
