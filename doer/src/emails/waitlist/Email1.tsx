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

interface Email1Props {
  unsubscribeUrl: string
}

export function Email1({ unsubscribeUrl }: Email1Props) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>How DOER Works</Text>
            <Text style={text}>
              We wanted to share a bit more about how DOER will help you achieve your goals.
            </Text>
            <Text style={text}>
              DOER uses AI to break down your big goals into manageable daily tasks. Simply tell us what you want to accomplish, and we'll create a personalized plan with tasks automatically scheduled around your existing calendar events.
            </Text>
            <Text style={text}>
              Whether you want to learn a new skill, start a business, get in shape, or achieve any other goal, DOER makes it easy by handling the planning and scheduling for you.
            </Text>
            <Text style={text}>
              We're getting closer to launch and can't wait to help you get started!
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






