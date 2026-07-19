/**
 * Transactional email via Resend (resend skill: lazy client, explicit
 * from, idempotency is unnecessary for reset links — each send is a fresh
 * single-use token). Email is an optional capability: when
 * `RESEND_API_KEY` is absent (local dev, preview deploys without
 * secrets), `isEmailConfigured` is false, the auth UI hides the
 * forgot-password entry point, and Better Auth never calls the sender.
 *
 * Server-only module — imported by `src/lib/auth.ts` (which already
 * imports the db) and never from client code.
 */
import { Resend } from 'resend'

import { env } from '#/env'
import { ResetPasswordEmail } from '#/server/email/ResetPasswordEmail'

/** `onboarding@resend.dev` is Resend's sandbox sender — works without a verified domain, fine for previews; production sets RESEND_FROM (DEPLOY.md). */
const DEFAULT_FROM = 'Roteiros <onboarding@resend.dev>'

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY)
}

let client: Resend | null = null

function getClient(): Resend {
  client ??= new Resend(env.RESEND_API_KEY)
  return client
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string
  url: string
}): Promise<void> {
  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM ?? DEFAULT_FROM,
    to,
    subject: 'Redefinir sua senha · Reset your password — Roteiros',
    react: <ResetPasswordEmail url={url} />,
  })
  if (error) {
    // Surface for the server log; Better Auth already sends the email in
    // the background (timing-attack protection), so there is no user
    // response to attach this to.
    console.error('sendPasswordResetEmail failed:', error)
  }
}
