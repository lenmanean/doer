import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Button,
  Hr,
} from '@react-email/components'

interface EmailLaunchProps {
  unsubscribeUrl: string
  signupUrl?: string
}

export function EmailLaunch({ unsubscribeUrl, signupUrl = 'https://usedoer.com/auth/signup' }: EmailLaunchProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>DOER is Live! 🎉</Text>
            <Text style={text}>
              We're thrilled to announce that DOER is now officially launched!
            </Text>
            <Text style={text}>
              As a waitlist member, you have early access to start using DOER right away. Create your account and begin turning your goals into reality.
            </Text>
            <Text style={text}>
              DOER will help you break down your goals, create actionable plans, and automatically schedule tasks around your calendar. Everything you need to achieve what matters most to you.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={signupUrl}>
                Get Started with DOER
              </Button>
            </Section>
            <Text style={text}>
              Thank you for being part of our journey. We can't wait to see what you'll accomplish!
            </Text>
            <Text style={signature}>
              Best regards,<br />
              The DOER Team
            </Text>
          </Section>
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const section = {
  padding: '0 48px',
}

const heading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#0a0a0a',
  margin: '0 0 20px',
}

const text = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 16px',
}

const buttonContainer = {
  padding: '24px 0',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#ff7f00',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const signature = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '24px 0 0',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '32px 0',
}

const footer = {
  padding: '0 48px',
}

const footerText = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#666666',
  margin: '0',
}

const unsubscribeLink = {
  color: '#666666',
  textDecoration: 'underline',
}















