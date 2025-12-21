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

interface Email2Props {
  unsubscribeUrl: string
}

export function Email2({ unsubscribeUrl }: Email2Props) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>Smart Scheduling</Text>
            <Text style={text}>
              One of the key features that makes DOER special is our smart scheduling system.
            </Text>
            <Text style={text}>
              DOER automatically finds the best times in your calendar to schedule tasks based on your availability, preferences, and the type of work required. It syncs with your Google Calendar, Outlook, or Apple Calendar to avoid conflicts and ensure you have time for what matters most.
            </Text>
            <Text style={text}>
              No more manually blocking time or trying to figure out when to fit everything in. DOER handles it all for you.
            </Text>
            <Text style={text}>
              We're working hard to make sure everything is perfect before we launch. Stay tuned!
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






