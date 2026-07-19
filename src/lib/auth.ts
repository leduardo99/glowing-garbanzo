import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db'
import { env } from '#/env'
import { isEmailConfigured, sendPasswordResetEmail } from '#/server/email'

/**
 * Optional capabilities, keyed off env presence so local/preview deploys
 * without secrets degrade cleanly (the auth UI reads these through
 * `getAuthCapabilities` in src/server/auth.ts and hides the affected
 * controls):
 * - Google social login: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 *   (redirect URI: <origin>/api/auth/callback/google — see DEPLOY.md)
 * - Password reset email: RESEND_API_KEY (+ optional RESEND_FROM)
 */
export const isGoogleLoginConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    // Skill guidance (email-and-password-best-practices): short-lived
    // single-use tokens, revoke every session once the password changes.
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    ...(isEmailConfigured()
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendPasswordResetEmail({ to: user.email, url })
          },
        }
      : {}),
  },
  ...(isGoogleLoginConfigured
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        },
      }
    : {}),
  plugins: [tanstackStartCookies()],
})
