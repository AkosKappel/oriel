import { createFileRoute, Link } from '@tanstack/react-router'
import {
  contactEmail,
  repositoryUrl,
  TextPage,
  TextSection,
} from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_site/about')({
  head: () => ({
    meta: pageMeta(m.about_title(), m.about_meta_description(), {
      indexed: true,
    }),
  }),
  component: About,
})

function About() {
  const whatItDoes = [
    m.about_w1(),
    m.about_w2(),
    m.about_w3(),
    m.about_w4(),
    m.about_w5(),
    m.about_w6(),
    m.about_w7(),
    m.about_w8(),
    m.about_w9(),
    m.about_w10(),
  ]
  return (
    <TextPage title={m.about_title()} lead={m.about_lead()}>
      <TextSection title={m.about_what()}>
        <ul>
          {whatItDoes.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </TextSection>

      <TextSection title={m.about_data()}>
        <ul>
          <li>{m.about_d1()}</li>
          <li>{m.about_d2()}</li>
          <li>{m.about_d3()}</li>
          <li>{m.about_d4()}</li>
        </ul>
        <p>
          {m.about_details_before()}{' '}
          <Link to="/privacy">{m.about_privacy_link()}</Link>
          {m.about_details_after()}
        </p>
      </TextSection>

      <TextSection title={m.about_built()}>
        <p>{m.about_built_text()}</p>
      </TextSection>

      <TextSection title={m.about_who()}>
        <p>
          {m.about_who_before()} <a href={repositoryUrl}>GitHub</a>
          {m.about_who_middle()}{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </TextSection>
    </TextPage>
  )
}
