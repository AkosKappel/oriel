import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { contactEmail, TextPage } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_site/faq')({
  head: () => ({
    meta: pageMeta(m.faq_meta_title(), m.faq_meta_description(), {
      indexed: true,
    }),
  }),
  component: Faq,
})

const questions = (): { question: string; answer: ReactNode }[] => [
  {
    question: m.faq_q1(),
    answer: (
      <p>
        {m.faq_a1_before()} <Link to="/app">{m.faq_a1_link()}</Link>
        {m.faq_a1_after()}
      </p>
    ),
  },
  { question: m.faq_q2(), answer: <p>{m.faq_a2()}</p> },
  {
    question: m.faq_q3(),
    answer: (
      <p>
        {m.faq_a3_before()} <Link to="/privacy">{m.faq_a3_link()}</Link>
        {m.faq_a3_after()}
      </p>
    ),
  },
  {
    question: m.faq_q4(),
    answer: (
      <ul>
        <li>{m.faq_a4_android()}</li>
        <li>{m.faq_a4_ios()}</li>
        <li>{m.faq_a4_desktop()}</li>
      </ul>
    ),
  },
  { question: m.faq_q5(), answer: <p>{m.faq_a5()}</p> },
  { question: m.faq_q6(), answer: <p>{m.faq_a6()}</p> },
  { question: m.faq_q7(), answer: <p>{m.faq_a7()}</p> },
  { question: m.faq_q8(), answer: <p>{m.faq_a8()}</p> },
  { question: m.faq_q9(), answer: <p>{m.faq_a9()}</p> },
  { question: m.faq_q10(), answer: <p>{m.faq_a10()}</p> },
  { question: m.faq_q11(), answer: <p>{m.faq_a11()}</p> },
]

function Faq() {
  return (
    <TextPage title={m.faq_title()} lead={m.faq_lead()}>
      <div className="flex flex-col">
        {questions().map(({ question, answer }) => (
          <details key={question} className="group border-b border-rule py-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm font-serif text-xl focus-visible:outline-2">
              {question}
              <span
                aria-hidden
                className="text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <div className="prose-text flex flex-col gap-3 pt-1 pb-4 text-muted-foreground">
              {answer}
            </div>
          </details>
        ))}
      </div>
      <p className="text-muted-foreground">
        Still curious? Write to{' '}
        <a
          href={`mailto:${contactEmail}`}
          className="underline underline-offset-4"
        >
          {contactEmail}
        </a>
        .
      </p>
    </TextPage>
  )
}
