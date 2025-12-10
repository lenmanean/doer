'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function SecurityPage() {
  const lastUpdated = 'January 2025'
  const contactEmail = 'help@usedoer.com'

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeInWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl mb-2">Security</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last Updated: {lastUpdated}
                </p>
              </CardHeader>
              <CardContent className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
              {/* Introduction */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">1. Security Commitment</h2>
                <p className="mb-4 leading-relaxed">
                  At DOER, security is a top priority. We implement industry-standard security measures to protect your data, ensure service availability, and maintain the integrity of our platform. This document outlines our security practices, infrastructure, and how we protect your information.
                </p>
                <p className="mb-4 leading-relaxed">
                  If you discover a security vulnerability, please report it to us immediately at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>. We take security issues seriously and will respond promptly.
                </p>
              </section>

              {/* Data Encryption */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">2. Data Encryption</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.1 Encryption in Transit</h3>
                <p className="mb-4 leading-relaxed">
                  All data transmitted between your device and our servers is encrypted using Transport Layer Security (TLS) 1.2 or higher. This ensures that:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>All communications are protected from interception</li>
                  <li>Data integrity is maintained during transmission</li>
                  <li>Your connection to our Service is authenticated</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We use strong cipher suites and regularly update our TLS configuration to maintain the highest security standards.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.2 Encryption at Rest</h3>
                <p className="mb-4 leading-relaxed">
                  All data stored in our database is encrypted at rest using industry-standard encryption algorithms. This includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>User account information and credentials</li>
                  <li>Plans, tasks, and goal data</li>
                  <li>Integration tokens and API keys (encrypted before storage)</li>
                  <li>Analytics and usage data</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  Database encryption keys are managed securely and rotated regularly according to best practices.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.3 Password Security</h3>
                <p className="mb-4 leading-relaxed">
                  Passwords are never stored in plain text. We use secure hashing algorithms (bcrypt) with salt to protect your password. This means:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Your password is hashed using a one-way cryptographic function</li>
                  <li>Each password is salted with a unique random value</li>
                  <li>Even if our database is compromised, your password cannot be recovered</li>
                  <li>We never have access to your actual password</li>
                </ul>
              </section>

              {/* Infrastructure Security */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">3. Infrastructure Security</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.1 Hosting and Cloud Infrastructure</h3>
                <p className="mb-4 leading-relaxed">
                  DOER is hosted on Vercel and uses Supabase for database and authentication services. Both platforms maintain:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>SOC 2 Type II compliance</li>
                  <li>ISO 27001 certification</li>
                  <li>Regular security audits and penetration testing</li>
                  <li>Redundant infrastructure for high availability</li>
                  <li>Automated backups and disaster recovery procedures</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.2 Network Security</h3>
                <p className="mb-4 leading-relaxed">
                  Our infrastructure is protected by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Firewalls and network segmentation</li>
                  <li>DDoS protection and rate limiting</li>
                  <li>Intrusion detection and prevention systems</li>
                  <li>Regular security monitoring and logging</li>
                  <li>Automated threat detection and response</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.3 Database Security</h3>
                <p className="mb-4 leading-relaxed">
                  Our database (PostgreSQL via Supabase) is secured through:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Encrypted connections for all database access</li>
                  <li>Row-level security (RLS) policies to restrict data access</li>
                  <li>Regular automated backups with point-in-time recovery</li>
                  <li>Access controls and audit logging</li>
                  <li>Database activity monitoring</li>
                </ul>
              </section>

              {/* Access Controls */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">4. Access Controls</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.1 User Authentication</h3>
                <p className="mb-4 leading-relaxed">
                  We implement strong authentication mechanisms:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Secure password requirements (minimum length, complexity)</li>
                  <li>Session management with secure tokens</li>
                  <li>Automatic session expiration and timeout</li>
                  <li>Protection against brute-force attacks</li>
                  <li>Email verification for account creation</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.2 Administrative Access</h3>
                <p className="mb-4 leading-relaxed">
                  Access to our internal systems and databases is restricted to authorized personnel only and follows the principle of least privilege:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Multi-factor authentication (MFA) required for all admin accounts</li>
                  <li>Role-based access controls</li>
                  <li>All access is logged and audited</li>
                  <li>Regular access reviews and credential rotation</li>
                  <li>Secure VPN and encrypted connections for remote access</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.3 API Security</h3>
                <p className="mb-4 leading-relaxed">
                  Our API endpoints are protected by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Authentication tokens for all API requests</li>
                  <li>Rate limiting to prevent abuse</li>
                  <li>Input validation and sanitization</li>
                  <li>Protection against common vulnerabilities (SQL injection, XSS, CSRF)</li>
                  <li>API key management for third-party integrations</li>
                </ul>
              </section>

              {/* Compliance */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">5. Compliance and Certifications</h2>
                <p className="mb-4 leading-relaxed">
                  While DOER is a growing platform, we are committed to maintaining security standards aligned with industry best practices:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>GDPR Compliance:</strong> We comply with the General Data Protection Regulation (GDPR) for users in the European Economic Area</li>
                  <li><strong>CCPA Compliance:</strong> We comply with the California Consumer Privacy Act (CCPA) for California residents</li>
                  <li><strong>Data Processing Agreements:</strong> We maintain data processing agreements with all third-party service providers</li>
                  <li><strong>Security Standards:</strong> Our infrastructure providers (Vercel, Supabase) maintain SOC 2, ISO 27001, and other certifications</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We regularly review and update our security practices to align with evolving regulations and industry standards.
                </p>
              </section>

              {/* Incident Response */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">6. Incident Response</h2>
                <p className="mb-4 leading-relaxed">
                  We have established procedures for responding to security incidents:
                </p>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.1 Detection and Response</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>24/7 monitoring of our systems for security threats</li>
                  <li>Automated alerts for suspicious activities</li>
                  <li>Incident response team ready to address security issues</li>
                  <li>Rapid containment and mitigation procedures</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.2 Notification</h3>
                <p className="mb-4 leading-relaxed">
                  In the event of a security breach that affects your personal data, we will:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Notify affected users within 72 hours, as required by law</li>
                  <li>Provide clear information about what happened and what data was affected</li>
                  <li>Explain the steps we are taking to address the issue</li>
                  <li>Provide guidance on steps you can take to protect yourself</li>
                  <li>Report to relevant data protection authorities when required</li>
                </ul>
              </section>

              {/* Security Best Practices */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">7. Security Best Practices for Users</h2>
                <p className="mb-4 leading-relaxed">
                  While we implement strong security measures, you also play an important role in protecting your account:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Use a Strong Password:</strong> Choose a unique, complex password that you don't use elsewhere</li>
                  <li><strong>Enable Email Verification:</strong> Keep your email address verified and up to date</li>
                  <li><strong>Log Out on Shared Devices:</strong> Always log out when using the Service on shared or public computers</li>
                  <li><strong>Be Cautious with Links:</strong> Only access DOER through our official domain (usedoer.com)</li>
                  <li><strong>Report Suspicious Activity:</strong> If you notice any suspicious activity on your account, contact us immediately</li>
                  <li><strong>Keep Your Email Secure:</strong> Your email account is used for password resets and security notifications</li>
                  <li><strong>Review Integration Permissions:</strong> Regularly review and revoke access for integrations you no longer use</li>
                </ul>
              </section>

              {/* Third-Party Security */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">8. Third-Party Service Security</h2>
                <p className="mb-4 leading-relaxed">
                  We use trusted third-party services that maintain high security standards:
                </p>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">8.1 Infrastructure Providers</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Vercel:</strong> Hosting and CDN with SOC 2 Type II compliance</li>
                  <li><strong>Supabase:</strong> Database and authentication with ISO 27001, SOC 2, and HIPAA compliance</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">8.2 Service Providers</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Stripe:</strong> Payment processing with PCI-DSS Level 1 compliance</li>
                  <li><strong>OpenAI:</strong> AI services with enterprise-grade security and data processing agreements</li>
                  <li><strong>Google Calendar API:</strong> Calendar integration with OAuth 2.0 security</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  All third-party integrations use secure authentication methods (OAuth 2.0, API keys) and encrypted connections.
                </p>
              </section>

              {/* Security Updates */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">9. Security Updates and Maintenance</h2>
                <p className="mb-4 leading-relaxed">
                  We regularly update our systems to address security vulnerabilities:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Regular security patches and updates</li>
                  <li>Dependency updates to address known vulnerabilities</li>
                  <li>Security code reviews for new features</li>
                  <li>Penetration testing and vulnerability assessments</li>
                  <li>Security training for our development team</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We monitor security advisories and apply patches promptly to protect against known threats.
                </p>
              </section>

              {/* Reporting Security Issues */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">10. Reporting Security Issues</h2>
                <p className="mb-4 leading-relaxed">
                  If you discover a security vulnerability in our Service, please report it to us responsibly:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Email us at{' '}
                    <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      {contactEmail}
                    </a> with details of the vulnerability
                  </li>
                  <li>Provide enough information for us to reproduce and verify the issue</li>
                  <li>Allow us reasonable time to address the vulnerability before public disclosure</li>
                  <li>Do not access or modify data that does not belong to you</li>
                  <li>Do not perform any actions that could harm our Service or other users</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We appreciate responsible disclosure and will work with security researchers to address vulnerabilities promptly. We will acknowledge receipt of your report and keep you informed of our progress.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">11. Contact Us</h2>
                <p className="mb-4 leading-relaxed">
                  If you have questions about our security practices or need to report a security issue, please contact us:
                </p>
                <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
                  <p className="mb-2"><strong>DOER</strong></p>
                  <p className="mb-2">Seattle, Washington, United States</p>
                  <p className="mb-2">
                    Email:{' '}
                    <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      {contactEmail}
                    </a>
                  </p>
                </div>
              </section>

              {/* Footer Note */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  This Security documentation is effective as of {lastUpdated} and applies to all users of the DOER Service.
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
      </main>
      <PublicFooter />
    </div>
  )
}
