import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
} from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ErrorNotice } from '#/components/error-notice'
import { ItemDetail } from '#/components/item-detail'
import { store } from '#/data/client'

export const Route = createFileRoute('/_notebook/items/$itemId')({
  component: ItemPage,
  // An item that fails to render takes only its own pane down; the list beside it keeps working.
  errorComponent: ItemError,
})

function ItemError({ error, reset }: ErrorComponentProps) {
  return (
    // The layout's pane is the page's main landmark already.
    <div className="flex flex-col gap-6 pb-12">
      {/* On a phone the list is hidden behind the item, so the way back has to be here. */}
      <Link
        to="/"
        search={true}
        className="-ml-3 flex h-11 w-fit items-center gap-2 rounded-sm px-3 pt-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 lg:invisible"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Everything
      </Link>
      <div className="pl-10">
        <ErrorNotice
          error={error}
          reset={reset}
          title="This page could not be shown."
        />
      </div>
    </div>
  )
}

function ItemPage() {
  const { itemId } = Route.useParams()
  return <ItemDetail store={store} itemId={itemId} />
}
