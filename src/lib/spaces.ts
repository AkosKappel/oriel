import { useLiveQuery } from '@tanstack/react-db'
import { store } from '#/data/client'
import type { Member, MemberRole, Space } from '#/data/schema'
import { useAccount } from '#/lib/account'

export type SpaceView = Space & {
  role: MemberRole
  personal: boolean
  members: Member[]
}

export const canEdit = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'editor'

/**
 * The signed-in user's spaces with their role in each, from the synced tables (so it works
 * offline). Personal first, then by name. Empty without an account.
 */
export function useSpaces() {
  const account = useAccount()
  const { data: spaces, isLoading } = useLiveQuery({
    query: (q) => q.from({ space: store.spaces }),
  })
  const { data: members } = useLiveQuery({
    query: (q) => q.from({ member: store.members }),
  })

  const views: SpaceView[] = []
  for (const space of account ? spaces : []) {
    const spaceMembers = members.filter(
      (member) => member.space_id === space.id,
    )
    const mine = spaceMembers.find(
      (member) => member.user_id === account?.userId,
    )
    if (!mine) continue
    views.push({
      ...space,
      role: mine.role,
      personal: space.personal_owner_id !== null,
      members: spaceMembers.sort((a, b) =>
        a.member_name.localeCompare(b.member_name),
      ),
    })
  }
  views.sort(
    (a, b) =>
      Number(b.personal) - Number(a.personal) || a.name.localeCompare(b.name),
  )

  return {
    spaces: views,
    byId: new Map(views.map((space) => [space.id, space])),
    isLoading,
  }
}
