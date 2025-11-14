import nodemailer from 'nodemailer'
import { getEnvConfig } from '@/lib/config/env'
import { logger } from '@/lib/logger'

let transporter: nodemailer.Transporter | null = null

function ensureEmailConfig() {
  const env = getEnvConfig()
  if (!env.email) {
    throw new Error(
      'Email configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_SENDER_ADDRESS, and EMAIL_SENDER_NAME environment variables.'
    )
  }
  return env.email
}

function getTransporter() {
  if (transporter) return transporter

  const email = ensureEmailConfig()
  transporter = nodemailer.createTransport({
    host: email.smtpHost,
    port: email.smtpPort,
    secure: email.smtpPort === 465,
    auth: {
      user: email.smtpUser,
      pass: email.smtpPassword,
    },
  })

  return transporter
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<void> {
  const email = ensureEmailConfig()
  const transport = getTransporter()

  try {
    await transport.sendMail({
      from: `"${email.senderName}" <${email.senderEmail}>`,
      to,
      subject,
      html,
      text,
    })
  } catch (error) {
    logger.error('Failed to send email', error as Error, { to, subject })
    throw error
  }
}

