import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'

interface EmailWelcomeProps {
  unsubscribeUrl: string
  dashboardUrl?: string
}

export function EmailWelcome({ unsubscribeUrl, dashboardUrl }: EmailWelcomeProps) {
  const dashboardLink = dashboardUrl || 'https://usedoer.com/dashboard'
  
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>Welcome to DOER! 🎉</Text>
            <Text style={text}>
              Thank you for joining DOER! We're thrilled to have you on board.
            </Text>
            <Text style={text}>
              DOER is an AI-powered planning tool that helps you break down your goals into actionable tasks and automatically schedules them around your calendar.
            </Text>
            <Text style={text}>
              You're all set to start turning your goals into reality. Here's what you can do next:
            </Text>
            <Text style={text}>
              • Set your first goal and let DOER break it down into manageable tasks<br />
              • Connect your calendar to automatically schedule tasks around your availability<br />
              • Let our AI help you stay organized and productive
            </Text>
            <Text style={text}>
              <Link href={dashboardLink} style={buttonLink}>
                Get Started
              </Link>
            </Text>
            <Text style={text}>
              If you have any questions or need help getting started, feel free to reach out to us at help@usedoer.com.
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

const buttonLink = {
  display: 'inline-block',
  padding: '12px 24px',
  backgroundColor: '#ff7f00',
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '6px',
  fontWeight: '600',
  margin: '16px 0',
}

