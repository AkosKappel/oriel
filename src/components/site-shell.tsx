import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Logo } from '#/components/logo'

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
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
        <Link to="/about" className={`${navLink} hidden sm:block`}>
          About
        </Link>
        <Link to="/faq" className={`${navLink} hidden sm:block`}>
          FAQ
        </Link>
        <Link to="/sign-in" className={navLink}>
          Sign in
        </Link>
        <Link to="/app" className={`${primaryButton} ml-1 h-10 px-4`}>
          Open Oriel
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
            One calm place for notes, lists and tasks. Made by Ákos Kappel.
          </p>
        </div>
        <FooterColumn title="Oriel">
          <Link to="/app" className={footerLink}>
            Open the app
          </Link>
          <Link to="/about" className={footerLink}>
            About
          </Link>
          <Link to="/faq" className={footerLink}>
            FAQ
          </Link>
          <Link to="/sign-in" className={footerLink}>
            Sign in
          </Link>
        </FooterColumn>
        <FooterColumn title="Legal">
          <Link to="/privacy" className={footerLink}>
            Privacy
          </Link>
          <Link to="/terms" className={footerLink}>
            Terms
          </Link>
          <Link to="/accessibility" className={footerLink}>
            Accessibility
          </Link>
        </FooterColumn>
        <FooterColumn title="Contact">
          <a href={`mailto:${contactEmail}`} className={footerLink}>
            Email
          </a>
          <a href={repositoryUrl} className={footerLink}>
            Source on GitHub
          </a>
        </FooterColumn>
      </div>
    </footer>
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
  children,
}: {
  title: string
  lead?: string
  /** For legal pages: when the text last changed, as `30 October 2026`. */
  updated?: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-10 sm:px-8 sm:pt-16">
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
            Last updated {updated}
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
