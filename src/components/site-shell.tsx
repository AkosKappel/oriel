import { Link } from '@tanstack/react-router'
import { type ReactNode, useId } from 'react'
import { Logo } from '#/components/logo'
import { languages } from '#/lib/locale'
import { m } from '#/paraglide/messages.js'
import { getLocale, type Locale, setLocale } from '#/paraglide/runtime.js'

export const contactEmail = 'kappelakos@gmail.com'
export const repositoryUrl = 'https://github.com/AkosKappel/oriel'

const navLink =
  'rounded-sm px-2 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 data-[status=active]:text-foreground'

export const primaryButton =
  'inline-flex h-11 items-center justify-center rounded-sm bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none'

/** The public pages' frame: the home page, about, FAQ and the legal pages. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-8">
      <Link
        to="/"
        className="-ml-1 flex items-center gap-2 rounded-sm px-1 py-1 focus-visible:outline-2"
      >
        <Logo className="size-7 text-primary" />
        <span className="font-serif text-2xl tracking-tight">Oriel</span>
      </Link>
      <nav
        aria-label={m.site_nav_main()}
        className="flex items-center gap-1 sm:gap-3"
      >
        <Link to="/about" className={`${navLink} hidden sm:block`}>
          {m.site_about()}
        </Link>
        <Link to="/faq" className={`${navLink} hidden sm:block`}>
          {m.site_faq()}
        </Link>
        <Link to="/sign-in" className={navLink}>
          {m.site_sign_in()}
        </Link>
        <Link to="/app" className={`${primaryButton} ml-1 h-10 px-4`}>
          {m.site_open()}
        </Link>
      </nav>
    </header>
  )
}

const footerLink =
  'w-fit rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2'

function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 pb-[max(3rem,env(safe-area-inset-bottom))] sm:grid-cols-2 sm:px-8 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="flex w-fit items-center gap-2 rounded-sm focus-visible:outline-2"
          >
            <Logo className="size-6 text-primary" />
            <span className="font-serif text-xl">Oriel</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            {m.site_tagline()}
          </p>
          <LanguageChoice />
        </div>
        <FooterColumn title="Oriel">
          <Link to="/app" className={footerLink}>
            {m.site_open_app()}
          </Link>
          <Link to="/about" className={footerLink}>
            {m.site_about()}
          </Link>
          <Link to="/faq" className={footerLink}>
            {m.site_faq()}
          </Link>
          <Link to="/sign-in" className={footerLink}>
            {m.site_sign_in()}
          </Link>
        </FooterColumn>
        <FooterColumn title={m.site_legal()}>
          <Link to="/privacy" className={footerLink}>
            {m.site_privacy()}
          </Link>
          <Link to="/terms" className={footerLink}>
            {m.site_terms()}
          </Link>
          <Link to="/accessibility" className={footerLink}>
            {m.site_accessibility()}
          </Link>
        </FooterColumn>
        <FooterColumn title={m.site_contact()}>
          <a href={`mailto:${contactEmail}`} className={footerLink}>
            {m.site_email()}
          </a>
          <a href={repositoryUrl} className={footerLink}>
            {m.site_source()}
          </a>
        </FooterColumn>
      </div>
    </footer>
  )
}

/** The language of every page; setLocale keeps it in a cookie and reloads. */
function LanguageChoice() {
  const id = useId()
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <label htmlFor={id}>{m.site_language()}</label>
      <select
        id={id}
        value={getLocale()}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="min-h-11 rounded-sm bg-transparent text-foreground focus-visible:outline-2"
      >
        {languages.map(({ locale, name }) => (
          <option key={locale} value={locale}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}

function FooterColumn({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">{title}</h2>
      {children}
    </nav>
  )
}

/** A text page (about, FAQ, legal): a title, an optional lead and a readable column. */
export function TextPage({
  title,
  lead,
  updated,
  englishOnly = false,
  children,
}: {
  title: string
  lead?: string
  /** For legal pages: when the text last changed, as `30 October 2026`. */
  updated?: string
  /** Legal texts are in English only; other languages get a note, and readers the right voice. */
  englishOnly?: boolean
  children: ReactNode
}) {
  const note = englishOnly && getLocale() !== 'en' ? m.site_english_only() : ''
  return (
    <article
      lang={englishOnly ? 'en' : undefined}
      className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-10 sm:px-8 sm:pt-16"
    >
      {note && (
        <p
          lang={getLocale()}
          className="rounded-sm bg-wash px-4 py-3 text-sm text-muted-foreground"
        >
          {note}
        </p>
      )}
      <header className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          {title}
        </h1>
        {lead && (
          <p className="max-w-2xl font-serif text-xl leading-relaxed text-muted-foreground">
            {lead}
          </p>
        )}
        {updated && (
          <p className="text-sm text-muted-foreground">
            {englishOnly
              ? `Last updated ${updated}`
              : m.site_updated({ date: updated })}
          </p>
        )}
      </header>
      {children}
    </article>
  )
}

/** A titled part of a text page, with prose in the notebook's serif. */
export function TextSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="prose-text flex flex-col gap-3">{children}</div>
    </section>
  )
}
