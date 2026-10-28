import { env } from '#/env'

// Server-only. Sends a transactional email through the Resend API (a single fetch, no SDK).
// Without RESEND_API_KEY the message goes to the console instead, so invites work in development
// and CI; production never logs links (they contain tokens). Returns whether it was sent.
export async function sendEmail(message: {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}) {
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        JSON.stringify({ email: 'not sent: RESEND_API_KEY is missing' }),
      )
    } else {
      console.info(
        `[email] to ${message.to}: ${message.subject}\n${message.text}`,
      )
    }
    return false
  }
  const { replyTo, ...rest } = message
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, reply_to: replyTo, ...rest }),
  })
  if (!response.ok) {
    // The body names the problem (unverified domain, bad key) without the message content.
    console.error(
      JSON.stringify({
        email: 'not sent',
        status: response.status,
        reason: (await response.text()).slice(0, 300),
      }),
    )
  }
  return response.ok
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`,
  )

/** A plain invite with one link: readable everywhere, no images or tracking. */
export function sendInviteEmail(invite: {
  to: string
  inviterName: string
  inviterEmail: string
  spaceName: string
  url: string
}) {
  const intro = `${invite.inviterName} invites you to ${invite.spaceName} on Oriel, to share notes, lists and tasks.`
  const outro =
    'The link works once and expires in 7 days. If you did not expect this, ignore the email.'
  return sendEmail({
    to: invite.to,
    replyTo: invite.inviterEmail,
    subject: `${invite.inviterName} invites you to ${invite.spaceName}`,
    text: `${intro}\n\nJoin ${invite.spaceName}: ${invite.url}\n\n${outro}`,
    html: `<div style="font-family:Georgia,serif;max-width:32rem;color:#1f1d1a">
<p style="font-size:18px">${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(invite.url)}" style="display:inline-block;padding:10px 16px;border-radius:4px;background:#1f1d1a;color:#faf8f3;text-decoration:none;font-family:system-ui,sans-serif">Join ${escapeHtml(invite.spaceName)}</a></p>
<p style="color:#6b665d;font-size:14px;font-family:system-ui,sans-serif">${escapeHtml(outro)}</p>
</div>`,
  })
}

/** The link from Better Auth's reset flow; it expires after an hour and works once. */
export function sendPasswordResetEmail(reset: { to: string; url: string }) {
  const intro = 'Someone asked to reset the password of your Oriel account.'
  const outro =
    'The link works once and expires in an hour. If it was not you, ignore the email; your password stays the same.'
  return sendEmail({
    to: reset.to,
    subject: 'Reset your Oriel password',
    text: `${intro}\n\nChoose a new password: ${reset.url}\n\n${outro}`,
    html: `<div style="font-family:Georgia,serif;max-width:32rem;color:#1f1d1a">
<p style="font-size:18px">${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(reset.url)}" style="display:inline-block;padding:10px 16px;border-radius:4px;background:#1f1d1a;color:#faf8f3;text-decoration:none;font-family:system-ui,sans-serif">Choose a new password</a></p>
<p style="color:#6b665d;font-size:14px;font-family:system-ui,sans-serif">${escapeHtml(outro)}</p>
</div>`,
  })
}
