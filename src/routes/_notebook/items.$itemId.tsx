import { createFileRoute } from '@tanstack/react-router'
import { ItemDetail } from '#/components/item-detail'
import { store } from '#/data/client'

export const Route = createFileRoute('/_notebook/items/$itemId')({
  component: ItemPage,
})

function ItemPage() {
  const { itemId } = Route.useParams()
  return <ItemDetail store={store} itemId={itemId} />
}
