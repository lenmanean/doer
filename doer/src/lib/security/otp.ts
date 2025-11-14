import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'

const OTP_ITERATIONS = 120_000
const OTP_KEY_LENGTH = 32
const OTP_DIGITS = 6

export function generateOtpCode(length = OTP_DIGITS): string {
  const max = 10 ** length
  const code = Math.floor(Math.random() * max)
  return code.toString().padStart(length, '0')
}

export function hashOtp(code: string, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(
    code,
    salt,
    OTP_ITERATIONS,
    OTP_KEY_LENGTH,
    'sha512'
  ).toString('hex')

  return { hash, salt }
}

export function verifyOtp({
  code,
  hash,
  salt,
}: {
  code: string
  hash: string
  salt: string
}): boolean {
  const derived = pbkdf2Sync(
    code,
    salt,
    OTP_ITERATIONS,
    OTP_KEY_LENGTH,
    'sha512'
  ).toString('hex')
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'))
}

