import { createFileRoute } from '@tanstack/react-router'
import { ItemDetail } from '#/components/item-detail'
import { store } from '#/data/client'

export const Route = createFileRoute('/items/$itemId')({
  ssr: false,
  component: ItemPage,
})

function ItemPage() {
  const { itemId } = Route.useParams()
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <ItemDetail store={store} itemId={itemId} />
    </div>
  )
}
