import { createFileRoute, Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { Button, FileTrigger } from 'react-aria-components'
import { toast } from 'sonner'
import { NotificationSettings } from '#/components/notification-settings'
import { SubPage } from '#/components/sub-page'
import { ChoiceGroup } from '#/components/ui/choice-group'
import type { parseExport } from '#/data/export'
import { useAccount } from '#/lib/account'
import { formatLocale, languages } from '#/lib/locale'
import { setTheme, type Theme, useTheme } from '#/lib/theme'
import { m } from '#/paraglide/messages.js'
import { getLocale, setLocale } from '#/paraglide/runtime.js'

export const Route = createFileRoute('/settings')({
  ssr: false,
  component: SettingsPage,
})

const themeChoices = (): { value: Theme; label: string }[] => [
  { value: 'system', label: m.theme_system() },
  { value: 'light', label: m.theme_light() },
  { value: 'dark', label: m.theme_dark() },
]

const textButton =
  'w-fit rounded-sm py-2 font-serif text-lg underline decoration-1 underline-offset-4 data-focus-visible:outline-2 data-focus-visible:outline-offset-2'

function SettingsPage() {
  const theme = useTheme()
  const account = useAccount()

  return (
    <SubPage>
      <h1 className="font-serif text-4xl tracking-tight">
        {m.settings_title()}
      </h1>

      <Section title={m.settings_appearance()}>
        <ChoiceGroup
          label={m.settings_theme()}
          choices={themeChoices()}
          value={theme}
          onChange={setTheme}
        />
        {/* setLocale keeps the choice in a cookie and reloads, so every page follows it. */}
        <ChoiceGroup
          label={m.settings_language()}
          choices={languages.map(({ locale, name }) => ({
            value: locale,
            label: name,
          }))}
          value={getLocale()}
          onChange={(locale) => setLocale(locale)}
        />
      </Section>

      <Section title={m.settings_data()}>
        <Storage />
        <div className="flex flex-col">
          <Button onPress={() => void exportAs('json')} className={textButton}>
            {m.export_json()}
          </Button>
          <Button
            onPress={() => void exportAs('markdown')}
            className={textButton}
          >
            {m.export_markdown()}
          </Button>
          <Button
            onPress={() => void exportAs('calendar')}
            className={textButton}
          >
            {m.export_calendar()}
          </Button>
          <FileTrigger
            acceptedFileTypes={['application/json', '.json']}
            onSelect={(files) => {
              const file = files?.[0]
              if (file) void importFrom(file)
            }}
          >
            <Button className={textButton}>{m.import_json()}</Button>
          </FileTrigger>
        </div>
        <p className="text-sm text-muted-foreground">{m.export_help()}</p>
      </Section>

      {account && (
        <NotificationSettings
          wrap={(settings) => (
            <Section title={m.settings_notifications()}>{settings}</Section>
          )}
        />
      )}

      <Section title={m.settings_account()}>
        {account ? (
          <Link to="/account" className={textButton}>
            {account.name}
          </Link>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {m.settings_no_account()}
            </p>
            <Link to="/sign-in" className={textButton}>
              {m.settings_sign_in_or_create()}
            </Link>
          </>
        )}
      </Section>

      <Section title={m.settings_oriel()}>
        <Link to="/about" className={textButton}>
          {m.settings_about()}
        </Link>
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

async function exportAs(format: 'json' | 'markdown' | 'calendar') {
  try {
    // Settings never needs the local database (or Zod) otherwise, so they load only for this.
    const [{ store }, { download, toCalendar, toJson, toMarkdown }] =
      await Promise.all([import('#/data/client'), import('#/data/export')])
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
    } else if (format === 'markdown') {
      download(`oriel-${day}.md`, toMarkdown(items, entries), 'text/markdown')
    } else {
      download('oriel-tasks.ics', toCalendar(items, now), 'text/calendar')
    }
  } catch (error) {
    console.error('Export failed', error)
    toast(m.export_failed())
  }
}

async function importFrom(file: File) {
  let parsed: ReturnType<typeof parseExport>
  try {
    const { parseExport } = await import('#/data/export')
    parsed = parseExport(await file.text())
  } catch {
    toast(m.import_not_export())
    return
  }
  try {
    const { store } = await import('#/data/client')
    const { added, skipped } = await store.importItems(parsed.items)
    const notes = [
      skipped > 0 && m.import_skipped({ count: skipped }),
      parsed.invalid > 0 && m.import_invalid({ count: parsed.invalid }),
    ].filter(Boolean)
    toast(
      notes.length > 0
        ? m.import_done_with_notes({ count: added, notes: notes.join(', ') })
        : m.import_done({ count: added }),
    )
  } catch (error) {
    console.error('Import failed', error)
    toast(m.import_failed())
  }
}

const megabytes = (bytes: number) =>
  new Intl.NumberFormat(formatLocale(), {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes / 1_000_000)

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
      toast(m.storage_denied())
    }
    setState(await readStorage())
  }

  if (!state) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="font-serif text-lg">
        {state.usage === undefined
          ? m.storage_stored()
          : m.storage_in_browser({ size: megabytes(state.usage) })}
      </p>
      <p className="text-sm text-muted-foreground">
        {state.persisted ? m.storage_kept() : m.storage_may_clear()}
      </p>
      {!state.persisted && (
        <Button
          onPress={() => void protect()}
          className="w-fit rounded-sm py-2 text-sm underline underline-offset-4 data-focus-visible:outline-2"
        >
          {m.storage_ask()}
        </Button>
      )}
    </div>
  )
}
