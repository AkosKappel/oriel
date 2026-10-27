import { createFileRoute, Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { Button, FileTrigger } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { ChoiceGroup } from '#/components/ui/choice-group'
import { download, parseExport, toJson, toMarkdown } from '#/data/export'
import { useAccount } from '#/lib/account'
import { setTheme, type Theme, useTheme } from '#/lib/theme'

export const Route = createFileRoute('/settings')({
  ssr: false,
  component: SettingsPage,
})

const themeChoices: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Like the device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const textButton =
  'w-fit rounded-sm py-2 font-serif text-lg underline decoration-1 underline-offset-4 data-focus-visible:outline-2 data-focus-visible:outline-offset-2'

function SettingsPage() {
  const theme = useTheme()
  const account = useAccount()

  return (
    <SubPage>
      <h1 className="font-serif text-4xl tracking-tight">Settings</h1>

      <Section title="Appearance">
        <ChoiceGroup
          label="Theme"
          choices={themeChoices}
          value={theme}
          onChange={setTheme}
        />
      </Section>

      <Section title="Your data">
        <Storage />
        <div className="flex flex-col">
          <Button onPress={() => void exportAs('json')} className={textButton}>
            Export as JSON
          </Button>
          <Button
            onPress={() => void exportAs('markdown')}
            className={textButton}
          >
            Export as Markdown
          </Button>
          <FileTrigger
            acceptedFileTypes={['application/json', '.json']}
            onSelect={(files) => {
              const file = files?.[0]
              if (file) void importFrom(file)
            }}
          >
            <Button className={textButton}>Import a JSON export</Button>
          </FileTrigger>
        </div>
        <p className="text-sm text-muted-foreground">
          Exports hold everything on this device, including shared spaces. JSON
          keeps every detail and can be imported again; Markdown opens in any
          notes app. Imported items join your own space, and items already here
          are skipped.
        </p>
      </Section>

      <Section title="Account">
        {account ? (
          <Link to="/account" className={textButton}>
            {account.name}
          </Link>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No account needed. Sign in to sync between devices and share
              lists.
            </p>
            <Link to="/sign-in" className={textButton}>
              Sign in or create an account
            </Link>
          </>
        )}
      </Section>
    </SubPage>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xs text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

async function exportAs(format: 'json' | 'markdown') {
  try {
    // Settings never needs the local database otherwise, so it loads only for this.
    const { store } = await import('#/data/client')
    await Promise.all([store.items.preload(), store.entries.preload()])
    const items = store.items.toArray
    const entries = store.entries.toArray
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    if (format === 'json') {
      download(
        `oriel-${day}.json`,
        toJson(items, entries, now),
        'application/json',
      )
    } else {
      download(`oriel-${day}.md`, toMarkdown(items, entries), 'text/markdown')
    }
  } catch (error) {
    console.error('Export failed', error)
    toast('Could not export. Try again.')
  }
}

async function importFrom(file: File) {
  let parsed: ReturnType<typeof parseExport>
  try {
    parsed = parseExport(await file.text())
  } catch {
    toast('That file is not an Oriel JSON export.')
    return
  }
  try {
    const { store } = await import('#/data/client')
    const { added, skipped } = await store.importItems(parsed.items)
    const notes = [
      skipped > 0 && `${skipped} already here or in the trash`,
      parsed.invalid > 0 && `${parsed.invalid} could not be read`,
    ].filter(Boolean)
    toast(
      `Imported ${added} ${added === 1 ? 'item' : 'items'}${notes.length > 0 ? ` (${notes.join(', ')})` : ''}.`,
    )
  } catch (error) {
    console.error('Import failed', error)
    toast('Could not import. Nothing was changed.')
  }
}

const sizeFormat = new Intl.NumberFormat('en-GB', {
  style: 'unit',
  unit: 'megabyte',
  maximumFractionDigits: 1,
})

type StorageState = { usage?: number; persisted: boolean } | null

async function readStorage(): Promise<StorageState> {
  if (!navigator.storage?.estimate) return null
  const [{ usage }, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted(),
  ])
  return { usage, persisted }
}

/** How much the notebook takes, and whether the browser may clear it when space runs low. */
function Storage() {
  const [state, setState] = useState<StorageState>(null)

  useEffect(() => {
    readStorage()
      .then(setState)
      .catch((error: unknown) => console.error('Could not read storage', error))
  }, [])

  async function protect() {
    const granted = await navigator.storage.persist()
    if (!granted) {
      toast('The browser decides this itself; it may allow it later.')
    }
    setState(await readStorage())
  }

  if (!state) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="font-serif text-lg">
        {state.usage === undefined
          ? 'Stored in this browser'
          : `${sizeFormat.format(state.usage / 1_000_000)} in this browser`}
      </p>
      <p className="text-sm text-muted-foreground">
        {state.persisted
          ? 'Kept safe: the browser will not clear it to free space.'
          : 'The browser may clear it if the device runs out of space.'}
      </p>
      {!state.persisted && (
        <Button
          onPress={() => void protect()}
          className="w-fit rounded-sm py-2 text-sm underline underline-offset-4 data-focus-visible:outline-2"
        >
          Ask to keep it
        </Button>
      )}
    </div>
  )
}
