// Who has a shared item open right now. Kept in this process's memory, like the rate limits:
// one app container, and nothing to lose on a restart (devices reconnect and say so again).

type Viewer = {
  userId: string
  name: string
  /** Hands the viewer the others on the item; called on every arrival and departure. */
  send: (others: string[]) => void
}

const viewers = new Map<string, Set<Viewer>>()

function broadcast(itemId: string) {
  const present = [...(viewers.get(itemId) ?? [])]
  for (const viewer of present) {
    // One name per person, however many tabs they have open.
    const others = new Map(
      present
        .filter((other) => other.userId !== viewer.userId)
        .map((other) => [other.userId, other.name]),
    )
    viewer.send([...others.values()].sort())
  }
}

/** Adds a viewer to an item and tells everyone there; returns how to leave again. */
export function join(itemId: string, viewer: Viewer) {
  const present = viewers.get(itemId) ?? new Set()
  present.add(viewer)
  viewers.set(itemId, present)
  broadcast(itemId)
  return () => {
    present.delete(viewer)
    if (present.size === 0) viewers.delete(itemId)
    else broadcast(itemId)
  }
}

/** Open presence streams of one user, to cap them. */
export const connectionsOf = (userId: string) =>
  [...viewers.values()].reduce(
    (count, present) =>
      count + [...present].filter((viewer) => viewer.userId === userId).length,
    0,
  )
