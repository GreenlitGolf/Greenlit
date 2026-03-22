import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from '@react-email/components'

interface WaitlistWelcomeEmailProps {
  email?: string
}

const green = '#1a2e1a'
const gold = '#c4a84f'
const cream = '#f5f0e8'
const textMid = '#4a4a4a'

export default function WaitlistWelcomeEmail({
  email = '',
}: WaitlistWelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You're on the Greenlit waitlist — we're building something great for your golf crew.</Preview>
      <Body style={body}>
        {/* Header */}
        <Section style={header}>
          <Text style={wordmark}>Greenlit</Text>
        </Section>

        <Container style={container}>
          {/* Greeting */}
          <Text style={heading}>Welcome to Greenlit.</Text>

          <Text style={paragraph}>
            Thanks for signing up — I'm genuinely excited to have you here.
          </Text>

          <Text style={paragraph}>
            Greenlit is the easiest way to plan a golf trip with your crew:
            courses, tee times, budgets, and RSVPs — all in one place, out of
            the group chat.
          </Text>

          <Text style={paragraph}>
            We're putting the finishing touches on everything and you'll be among
            the first to get access when we launch.
          </Text>

          {/* Reply question */}
          <Section style={questionBox}>
            <Text style={questionLabel}>Quick question —</Text>
            <Text style={questionText}>
              What's the most frustrating part of planning a golf trip with your
              group?
            </Text>
            <Text style={questionHint}>
              Just hit reply — I read every response.
            </Text>
          </Section>

          {/* Sign-off */}
          <Text style={paragraph}>Talk soon,</Text>
          <Text style={signoff}>Michael</Text>
          <Text style={signoffTitle}>Founder, Greenlit</Text>
        </Container>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            You're receiving this because {email || 'you'} signed up for the
            Greenlit waitlist.
          </Text>
          <Text style={footerText}>
            Greenlit &middot;{' '}
            <Link href="https://greenlit.golf" style={footerLink}>
              greenlit.golf
            </Link>
          </Text>
          <Text style={footerText}>
            If you didn't sign up, you can safely ignore this email or{' '}
            <Link href="mailto:hello@greenlit.golf?subject=Unsubscribe" style={footerLink}>
              unsubscribe
            </Link>
            .
          </Text>
        </Section>
      </Body>
    </Html>
  )
}

/* ─── Styles ─── */

const body: React.CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: cream,
  fontFamily: "'Jost', Helvetica, Arial, sans-serif",
}

const header: React.CSSProperties = {
  backgroundColor: green,
  padding: '32px 24px',
  textAlign: 'center' as const,
}

const wordmark: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '22px',
  color: gold,
  letterSpacing: '0.02em',
  margin: 0,
}

const container: React.CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '40px 24px 32px',
}

const heading: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '28px',
  color: green,
  fontWeight: 400,
  margin: '0 0 24px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  color: textMid,
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const questionBox: React.CSSProperties = {
  backgroundColor: '#eae4d8',
  borderLeft: `3px solid ${gold}`,
  borderRadius: '4px',
  padding: '20px 24px',
  margin: '28px 0',
}

const questionLabel: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: green,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
}

const questionText: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '17px',
  fontStyle: 'italic' as const,
  color: green,
  lineHeight: '1.5',
  margin: '0 0 10px',
}

const questionHint: React.CSSProperties = {
  fontSize: '13px',
  color: textMid,
  margin: 0,
}

const signoff: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '17px',
  color: green,
  fontWeight: 600,
  margin: '0 0 2px',
}

const signoffTitle: React.CSSProperties = {
  fontSize: '13px',
  color: textMid,
  margin: '0 0 0',
}

const footer: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '24px',
  borderTop: '1px solid #ede5d4',
}

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#8a8a8a',
  margin: '0 0 8px',
  lineHeight: '1.5',
}

const footerLink: React.CSSProperties = {
  color: '#8a8a8a',
  textDecoration: 'underline',
}
