/**
 * Password-reset email, in the Trilha Tropical voice (DESIGN.md): cream
 * paper, one deep-mata action, Georgia serif for the title (webfonts are
 * unreliable in email clients — Georgia is the system fallback the app
 * itself declares for Fraunces). Bilingual pt-BR-first body: reset links
 * are sent before we know the reader's UI locale, and the community is
 * primarily Brazilian with international readers (PRODUCT.md).
 *
 * Table-based react-email primitives only — no flex/grid — per the
 * react-email/email-best-practices skills (Outlook et al.).
 */
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

const paper = '#f9f5ef'
const surface = '#fdfcfa'
const ink = '#2b3a31'
const inkSoft = '#5f6f64'
const mata = '#1d5c38'

export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Redefina sua senha do Roteiros · Reset your Roteiros password</Preview>
      <Body style={{ backgroundColor: paper, margin: 0, padding: '32px 16px' }}>
        <Container
          style={{
            backgroundColor: surface,
            borderRadius: 16,
            maxWidth: 480,
            padding: '32px 32px 28px',
          }}
        >
          <Text
            style={{
              color: mata,
              fontFamily: 'Verdana, Geneva, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
              margin: '0 0 20px',
            }}
          >
            Roteiros
          </Text>
          <Text
            style={{
              color: ink,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 24,
              lineHeight: '30px',
              margin: '0 0 12px',
            }}
          >
            Redefinir sua senha
          </Text>
          <Text
            style={{
              color: inkSoft,
              fontFamily: 'Verdana, Geneva, sans-serif',
              fontSize: 14,
              lineHeight: '22px',
              margin: '0 0 8px',
            }}
          >
            Recebemos um pedido para redefinir a senha da sua conta. O link
            abaixo vale por 30 minutos e só pode ser usado uma vez.
          </Text>
          <Text
            style={{
              color: inkSoft,
              fontFamily: 'Verdana, Geneva, sans-serif',
              fontSize: 12,
              lineHeight: '18px',
              margin: '0 0 24px',
            }}
          >
            We received a request to reset your password. The link below is
            valid for 30 minutes and can be used once.
          </Text>
          <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
            <Button
              href={url}
              style={{
                backgroundColor: mata,
                borderRadius: 12,
                color: '#fcfaf5',
                display: 'inline-block',
                fontFamily: 'Verdana, Geneva, sans-serif',
                fontSize: 14,
                fontWeight: 700,
                padding: '12px 24px',
                textDecoration: 'none',
              }}
            >
              Redefinir senha · Reset password
            </Button>
          </Section>
          <Text
            style={{
              color: inkSoft,
              fontFamily: 'Verdana, Geneva, sans-serif',
              fontSize: 12,
              lineHeight: '18px',
              margin: 0,
            }}
          >
            Se você não pediu isso, pode ignorar este email — sua senha
            continua a mesma. · If you didn't request this, you can safely
            ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
