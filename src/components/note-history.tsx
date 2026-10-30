import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { formatDateTime } from '#/lib/dates'
import { m } from '#/paraglide/messages.js'
import { listVersions } from '#/server/history-functions'

type Version = Awaited<ReturnType<typeof listVersions>>[number]

const textButton =
  'rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2'

/**
 * Earlier texts of an item, from the server (one per editing session, kept 90 days), each with
 * Restore. Needs a connection; shown for items that sync.
 */
export function NoteHistory({
  itemId,
  currentBody,
  canRestore,
  nameOf,
  onRestore,
}: {
  itemId: string
  currentBody: string
  canRestore: boolean
  /** Who saved a version: "you", a member's name, or undefined once they left. */
  nameOf: (userId: string | null) => string | undefined
  onRestore: (body: string) => void
}) {
  return (
    <DialogTrigger>
      <Button className={`-ml-2 block px-2 ${textButton} print:hidden`}>
        {m.history()}
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center"
      >
        <Modal className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-md bg-background p-6 shadow-lg">
          <Dialog className="flex flex-col gap-4 outline-none">
            {({ close }) => (
              <>
                <Heading slot="title" className="font-serif text-2xl">
                  {m.history_title()}
                </Heading>
                <Versions
                  itemId={itemId}
                  currentBody={currentBody}
                  canRestore={canRestore}
                  nameOf={nameOf}
                  onRestore={(body) => {
                    close()
                    onRestore(body)
                  }}
                />
                <Button onPress={close} className={`self-end ${textButton}`}>
                  {m.close()}
                </Button>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}

function Versions({
  itemId,
  currentBody,
  canRestore,
  nameOf,
  onRestore,
}: {
  itemId: string
  currentBody: string
  canRestore: boolean
  nameOf: (userId: string | null) => string | undefined
  onRestore: (body: string) => void
}) {
  const [versions, setVersions] = useState<Version[] | 'offline'>()

  useEffect(() => {
    listVersions({ data: { itemId } }).then(setVersions, () =>
      setVersions('offline'),
    )
  }, [itemId])

  if (versions === undefined) {
    return (
      <p className="text-sm text-muted-foreground">{m.history_loading()}</p>
    )
  }
  if (versions === 'offline') {
    return (
      <p className="text-sm text-muted-foreground">{m.history_offline()}</p>
    )
  }
  const earlier = versions.filter((version) => version.body !== currentBody)
  if (earlier.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.history_none()}</p>
  }
  return (
    <ul className="flex flex-col gap-5">
      {earlier.map((version) => {
        const who = nameOf(version.savedBy) ?? m.someone_who_left()
        return (
          <li key={version.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>
                <time dateTime={version.savedAt}>
                  {formatDateTime(version.savedAt)}
                </time>{' '}
                · {who}
              </span>
              {canRestore && (
                <Button
                  onPress={() => onRestore(version.body)}
                  className="rounded-sm px-2 py-2 text-foreground underline underline-offset-4 data-focus-visible:outline-2"
                >
                  {m.restore()}
                </Button>
              )}
            </div>
            <p className="line-clamp-4 font-serif text-base whitespace-pre-wrap">
              {version.body || (
                <span className="text-muted-foreground">
                  {m.history_empty_text()}
                </span>
              )}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
