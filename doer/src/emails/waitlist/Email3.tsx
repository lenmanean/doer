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

interface Email3Props {
  unsubscribeUrl: string
}

export function Email3({ unsubscribeUrl }: Email3Props) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>We're Almost There!</Text>
            <Text style={text}>
              We wanted to give you a quick update on our progress.
            </Text>
            <Text style={text}>
              We're in the final stages of development and testing. Our team is working around the clock to ensure DOER delivers the best possible experience when we launch.
            </Text>
            <Text style={text}>
              As a waitlist member, you'll be among the first to know when DOER is ready. We'll send you a special notification with early access details.
            </Text>
            <Text style={text}>
              Thank you for your patience and for being part of this journey with us!
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






