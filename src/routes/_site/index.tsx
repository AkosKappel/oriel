import { createFileRoute, Link, ScriptOnce } from '@tanstack/react-router'
import {
  Keyboard,
  ListChecks,
  type LucideIcon,
  ShieldCheck,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react'
import { primaryButton } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_site/')({
  head: () => ({
    meta: pageMeta(m.home_meta_title(), m.home_meta_description(), {
      indexed: true,
    }),
  }),
  component: Home,
})

// A device that has used Oriel before goes straight to its notebook when it opens this address
// itself (a bookmark, the old installed app); links within the site still show this page.
const returningVisitor = `try{var r=document.referrer,s=r&&new URL(r).origin===location.origin;if(!s&&(localStorage.getItem('oriel.account')||localStorage.getItem('oriel.used')))location.replace('/app')}catch(e){}`

const features = (): { icon: LucideIcon; title: string; text: string }[] => [
  { icon: Zap, title: m.home_f1_title(), text: m.home_f1_text() },
  { icon: WifiOff, title: m.home_f2_title(), text: m.home_f2_text() },
  { icon: Users, title: m.home_f3_title(), text: m.home_f3_text() },
  { icon: ListChecks, title: m.home_f4_title(), text: m.home_f4_text() },
  { icon: Keyboard, title: m.home_f5_title(), text: m.home_f5_text() },
  { icon: ShieldCheck, title: m.home_f6_title(), text: m.home_f6_text() },
]

const steps = () => [
  { title: m.home_s1_title(), text: m.home_s1_text() },
  { title: m.home_s2_title(), text: m.home_s2_text() },
  { title: m.home_s3_title(), text: m.home_s3_text() },
]

function Home() {
  return (
    <>
      <ScriptOnce>{returningVisitor}</ScriptOnce>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-20">
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">{m.home_eyebrow()}</p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            {m.home_title()}
          </h1>
          <p className="max-w-xl font-serif text-xl leading-relaxed text-muted-foreground">
            {m.home_lead()}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/app" className={primaryButton}>
              {m.home_start()}
            </Link>
            <Link
              to="/sign-in"
              className="rounded-sm px-1 py-2 text-sm underline underline-offset-4 hover:text-primary focus-visible:outline-2"
            >
              {m.home_create_account()}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{m.home_free()}</p>
        </div>
        <picture>
          <source
            srcSet="/screenshots/app-dark.jpg"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/screenshots/app-light.jpg"
            alt={m.home_screenshot_alt()}
            width={1280}
            height={800}
            className="w-full rounded-md shadow-xl ring-1 ring-rule"
          />
        </picture>
      </section>

      <section
        aria-labelledby="features"
        className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32"
      >
        <h2
          id="features"
          className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl"
        >
          {m.home_features_title()}
        </h2>
        <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features().map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-6 text-primary" />
              <h3 className="font-serif text-xl">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="how"
        className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32"
      >
        <h2
          id="how"
          className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl"
        >
          {m.home_how_title()}
        </h2>
        <ol className="mt-12 grid gap-10 lg:grid-cols-3">
          {steps().map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-serif text-4xl text-primary">
                {index + 1}
              </span>
              <h3 className="font-serif text-xl">{step.title}</h3>
              <p className="text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-muted-foreground">
          {m.home_curious()}{' '}
          <Link to="/about" className="underline underline-offset-4">
            {m.home_read_about()}
          </Link>{' '}
          {m.home_or_the()}{' '}
          <Link to="/faq" className="underline underline-offset-4">
            {m.home_questions()}
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32">
        <div className="flex flex-col items-start gap-6 rounded-md bg-wash px-6 py-12 sm:px-12">
          <h2 className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl">
            {m.home_cta_title()}
          </h2>
          <p className="max-w-xl text-muted-foreground">{m.home_cta_text()}</p>
          <Link to="/app" className={primaryButton}>
            {m.site_open()}
          </Link>
        </div>
      </section>
    </>
  )
}
