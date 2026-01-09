'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function PrivacyPage() {
  const lastUpdated = 'January 2025'
  const contactEmail = 'help@usedoer.com'
  const titleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const cardAnim = useScrollAnimation({ delay: 150, triggerOnce: true })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 
            ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
          >
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last Updated: {lastUpdated}
          </p>
        </div>
        <Card
          ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
          className={`scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
        >
            <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl mb-2">Privacy Policy</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                Last Updated: {lastUpdated}
              </p>
            </CardHeader>
              <CardContent className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
              {/* Introduction */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">1. Introduction</h2>
                <p className="mb-4 leading-relaxed">
                  DOER ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered goal achievement platform (the "Service") available at usedoer.com.
                </p>
                <p className="mb-4 leading-relaxed">
                  DOER is based in Seattle, Washington, United States. By using our Service, you agree to the collection and use of information in accordance with this policy.
                </p>
                <p className="mb-4 leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>.
                </p>
              </section>

              {/* Information We Collect */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">2. Information We Collect</h2>
                <p className="mb-4 leading-relaxed">We collect several types of information to provide and improve our Service:</p>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.1 Account Information</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Email address (required for account creation)</li>
                  <li>Username (optional, for account identification)</li>
                  <li>Password (stored in hashed format using secure encryption)</li>
                  <li>Authentication tokens and session data</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.2 Profile Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Display name</li>
                  <li>Avatar URL (if you upload a profile picture)</li>
                  <li>Timezone and locale preferences</li>
                  <li>User preferences including:
                    <ul className="list-circle pl-6 mt-2 space-y-1">
                      <li>Workday hours (start/end times, lunch breaks)</li>
                      <li>Time format (12-hour or 24-hour)</li>
                      <li>Theme preferences (dark/light mode)</li>
                      <li>Privacy settings (analytics preferences, model improvement consent)</li>
                    </ul>
                  </li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.3 Goal & Plan Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Goal text and descriptions</li>
                  <li>Clarification responses (when you provide additional context about your goals)</li>
                  <li>Start dates and end dates for your plans</li>
                  <li>Plan status (active, completed, paused, archived)</li>
                  <li>Plan type (AI-generated or manually created)</li>
                  <li>Timeline and summary data</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.4 Task Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Task names and detailed descriptions</li>
                  <li>Estimated duration for each task</li>
                  <li>Complexity scores and priority levels</li>
                  <li>Task schedules (dates, start times, end times)</li>
                  <li>Task categories and classifications</li>
                  <li>Rescheduling history and adjustments</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.5 Completion & Analytics Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Task completion timestamps</li>
                  <li>Scheduled vs. actual completion dates</li>
                  <li>Productivity patterns and trends</li>
                  <li>Completion rates and consistency metrics</li>
                  <li>Health scores and progress tracking</li>
                  <li>Rescheduling frequency and patterns</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.6 Integration Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Google Calendar connection tokens (encrypted and stored securely)</li>
                  <li>Selected calendar IDs for synchronization</li>
                  <li>Auto-sync and auto-push preferences</li>
                  <li>Calendar event data (when you choose to sync tasks to your calendar)</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.7 Usage & Billing Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>API usage credits and consumption</li>
                  <li>Subscription information and plan details</li>
                  <li>Billing data processed through Stripe (payment method information is handled by Stripe, not stored by us)</li>
                  <li>Subscription status and renewal dates</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.8 Newsletter & Marketing Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Email address (when you subscribe to our newsletter)</li>
                  <li>Subscription source (blog, landing page, etc.)</li>
                  <li>Subscription status and preferences</li>
                  <li>IP address and user agent (collected at time of subscription for security and compliance)</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.9 Technical Data</h3>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>IP addresses</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Cookies and similar tracking technologies</li>
                  <li>Usage patterns and service interaction data</li>
                </ul>
              </section>

              {/* How We Use Your Information */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">3. How We Use Your Information</h2>
                <p className="mb-4 leading-relaxed">We use the collected information for the following purposes:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Service Provision:</strong> To provide, maintain, and improve our Service, including generating AI-powered plans, managing your tasks, and tracking your progress</li>
                  <li><strong>AI Plan Generation:</strong> To process your goals through OpenAI's services to generate personalized action plans and task breakdowns</li>
                  <li><strong>Calendar Integration:</strong> To sync your tasks with Google Calendar when you choose to connect your calendar account</li>
                  <li><strong>Payment Processing:</strong> To process payments, manage subscriptions, and handle billing through Stripe</li>
                  <li><strong>Communication:</strong> To send you email notifications, service updates, and important account-related information</li>
                  <li><strong>Newsletter:</strong> To send you newsletter emails with articles, tips, and updates when you subscribe (you can unsubscribe at any time)</li>
                  <li><strong>Analytics & Insights:</strong> To provide you with productivity analytics, completion trends, and personalized insights about your goal achievement patterns</li>
                  <li><strong>Service Improvement:</strong> With your explicit consent (via the <code className="bg-[#1a1a1a] px-1 rounded">improve_model_enabled</code> preference), we may use your data to improve our AI models and service quality</li>
                  <li><strong>Security:</strong> To detect, prevent, and address technical issues, fraud, and security threats</li>
                  <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
                  <li><strong>User Support:</strong> To respond to your inquiries, provide customer support, and address technical issues</li>
                </ul>
              </section>

              {/* Third-Party Services */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">4. Third-Party Services & Data Sharing</h2>
                <p className="mb-4 leading-relaxed">
                  We use third-party services to operate our Service. These service providers have access to your information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose:
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.1 Supabase</h3>
                <p className="mb-4 leading-relaxed">
                  We use Supabase for database storage, user authentication, and email services. Supabase processes your account information, profile data, plans, tasks, and all other data stored in our Service. Supabase is bound by data processing agreements and maintains industry-standard security measures.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.2 OpenAI</h3>
                <p className="mb-4 leading-relaxed">
                  When you request an AI-generated plan, we send your goal text, clarifications, and related context to OpenAI's API to generate your personalized action plan. OpenAI processes this data according to their privacy policy. We do not send your personal identifying information (email, name) to OpenAI, only the goal-related content necessary for plan generation.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.3 Google Calendar</h3>
                <p className="mb-4 leading-relaxed">
                  If you choose to connect your Google Calendar account, we use Google Calendar API to sync your tasks. We store encrypted OAuth tokens to maintain the connection. When you enable calendar sync, we may read your calendar events to avoid scheduling conflicts and write tasks as calendar events. Google processes this data according to their privacy policy.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.4 Stripe</h3>
                <p className="mb-4 leading-relaxed">
                  We use Stripe to process payments and manage subscriptions. Stripe handles payment card information and billing details. We do not store your full payment card details. Stripe processes payment data according to their privacy policy and PCI-DSS compliance standards.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.5 Email Services</h3>
                <p className="mb-4 leading-relaxed">
                  We use Nodemailer and Supabase's email services to send transactional emails, notifications, and account-related communications. These services process your email address and email content to deliver messages.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.6 Data Sale</h3>
                <p className="mb-4 leading-relaxed">
                  <strong>We do not sell your personal information.</strong> We do not share your data with third parties for their marketing purposes. We only share data as necessary to provide our Service and as described in this Privacy Policy.
                </p>
              </section>

              {/* Data Storage & Security */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">5. Data Storage & Security</h2>
                <p className="mb-4 leading-relaxed">We implement appropriate technical and organizational measures to protect your personal information:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Encryption:</strong> Data is encrypted in transit using TLS/SSL and at rest in our database</li>
                  <li><strong>Password Security:</strong> Passwords are hashed using secure algorithms and never stored in plain text</li>
                  <li><strong>Token Encryption:</strong> Third-party integration tokens (e.g., Google Calendar) are encrypted before storage</li>
                  <li><strong>Access Controls:</strong> We implement role-based access controls and limit access to personal data to authorized personnel only</li>
                  <li><strong>Database Security:</strong> Data is stored in Supabase's secure PostgreSQL database with regular security updates</li>
                  <li><strong>Regular Audits:</strong> We conduct regular security assessments and updates</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  While we strive to protect your personal information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security but are committed to maintaining industry-standard protections.
                </p>
              </section>

              {/* Data Retention */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">6. Data Retention</h2>
                <p className="mb-4 leading-relaxed">We retain your personal information for as long as necessary to provide our Service and fulfill the purposes outlined in this Privacy Policy:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Active Accounts:</strong> We retain your data while your account is active and you are using our Service</li>
                  <li><strong>Account Deletion:</strong> When you delete your account, we immediately delete your personal data from our active systems. However, data may remain in our backups for 30-90 days before being permanently deleted. Audit logs of account deletions are retained for 7 years for compliance purposes.</li>
                  <li><strong>Billing Data:</strong> Financial transaction records are retained by our payment processor (Stripe) for legal compliance. Personal identifiers in these records may be redacted upon request. See section 7.3 for more details.</li>
                  <li><strong>Legal Requirements:</strong> We may retain certain information for longer periods if required by law, to resolve disputes, or to enforce our agreements</li>
                  <li><strong>Anonymized Data:</strong> We may retain anonymized, aggregated data that cannot identify you for analytical and service improvement purposes</li>
                </ul>
              </section>

              {/* User Rights */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">7. Your Privacy Rights</h2>
                <p className="mb-4 leading-relaxed">Depending on your location, you may have the following rights regarding your personal information:</p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.1 Right to Access</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to request access to the personal information we hold about you. You can view and update much of your information directly through your account settings.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.2 Right to Rectification</h3>
                <p className="mb-4 leading-relaxed">
                  You can update your profile information, preferences, and other data through your account settings. If you need assistance updating information, please contact us.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.3 Right to Erasure</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to request deletion of your personal information. You can delete your account and all associated data through your account settings, or by using our data deletion API endpoints. This will permanently delete:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>All your plans and goals</li>
                  <li>All tasks and task schedules</li>
                  <li>Completion history and analytics data</li>
                  <li>Health snapshots and scheduling history</li>
                  <li>Profile information and preferences</li>
                  <li>Integration connections (e.g., Google Calendar)</li>
                  <li>Your subscription will be canceled immediately</li>
                  <li>Your billing information will be removed from Stripe (customer deleted)</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  <strong>Stripe Data Retention:</strong> When you delete your account, we remove your billing information from Stripe by deleting your customer record. However, Stripe retains certain financial transaction records (invoices, payment intents, charges) for legal and compliance purposes, as required by financial regulations. Personal identifiers in these records may be redacted upon request. For more information about Stripe's data retention practices, please see{' '}
                  <a 
                    href="https://stripe.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 underline"
                  >
                    Stripe's Privacy Policy
                  </a>.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.4 Right to Data Portability</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to receive a copy of your personal data in a structured, machine-readable format. Contact us to request your data export.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.5 Right to Object</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to object to certain processing of your personal information, including processing for direct marketing purposes or based on legitimate interests.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.6 Privacy Preferences</h3>
                <p className="mb-4 leading-relaxed">
                  You can control certain aspects of data processing through your privacy preferences:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Analytics:</strong> You can opt-in or opt-out of analytics data collection via the <code className="bg-[#1a1a1a] px-1 rounded">analytics_enabled</code> preference (default: disabled)</li>
                  <li><strong>Model Improvement:</strong> You can opt-in to allow your data to be used for improving our AI models via the <code className="bg-[#1a1a1a] px-1 rounded">improve_model_enabled</code> preference (default: disabled)</li>
                  <li><strong>Newsletter:</strong> You can unsubscribe from our newsletter at any time by contacting us at{' '}
                    <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      {contactEmail}
                    </a> or using the unsubscribe link in any newsletter email</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  These preferences can be updated in your account settings at any time.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.7 Exercising Your Rights</h3>
                <p className="mb-4 leading-relaxed">
                  To exercise any of these rights, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>. We will respond to your request within 30 days, or as required by applicable law.
                </p>
              </section>

              {/* Cookies */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">8. Cookies & Tracking Technologies</h2>
                <p className="mb-4 leading-relaxed">We use cookies and similar tracking technologies to operate and improve our Service:</p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">8.1 Essential Cookies</h3>
                <p className="mb-4 leading-relaxed">
                  These cookies are necessary for the Service to function and cannot be disabled:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Authentication Cookies:</strong> Used to maintain your login session and authenticate your requests (managed by Supabase)</li>
                  <li><strong>Security Cookies:</strong> Used to protect against security threats and maintain service integrity</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">8.2 Analytics Cookies</h3>
                <p className="mb-4 leading-relaxed">
                  With your consent (via the <code className="bg-[#1a1a1a] px-1 rounded">analytics_enabled</code> preference), we may use analytics cookies to understand how you use our Service and improve user experience.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">8.3 Cookie Management</h3>
                <p className="mb-4 leading-relaxed">
                  You can control cookies through your browser settings. However, disabling essential cookies may impact your ability to use certain features of our Service. You can manage analytics preferences through your account settings.
                </p>
              </section>

              {/* Children's Privacy */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">9. Children's Privacy</h2>
                <p className="mb-4 leading-relaxed">
                  Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately. If we discover that we have collected information from a child under 13, we will delete that information promptly.
                </p>
                <p className="mb-4 leading-relaxed">
                  If you are between the ages of 13 and 18, you must have your parent's or guardian's permission to use our Service.
                </p>
              </section>

              {/* International Data Transfers */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">10. International Data Transfers</h2>
                <p className="mb-4 leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. Specifically:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Our primary data storage is through Supabase, which may process data in various data center locations</li>
                  <li>Third-party services (OpenAI, Google, Stripe) may process data in their respective service locations</li>
                  <li>We ensure that appropriate safeguards are in place, including data processing agreements and standard contractual clauses where applicable</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  By using our Service, you consent to the transfer of your information to these locations.
                </p>
              </section>

              {/* California Privacy Rights */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">11. California Privacy Rights (CCPA)</h2>
                <p className="mb-4 leading-relaxed">
                  If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">11.1 Right to Know</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to know what personal information we collect, use, disclose, and sell. This Privacy Policy provides detailed information about our data practices.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">11.2 Right to Delete</h3>
                <p className="mb-4 leading-relaxed">
                  You have the right to request deletion of your personal information. You can delete your account and data through your account settings or by contacting us.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">11.3 Right to Opt-Out of Sale</h3>
                <p className="mb-4 leading-relaxed">
                  <strong>We do not sell your personal information.</strong> We do not share your data with third parties for their marketing purposes.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">11.4 Non-Discrimination</h3>
                <p className="mb-4 leading-relaxed">
                  We will not discriminate against you for exercising your privacy rights under CCPA.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">11.5 Exercising Your Rights</h3>
                <p className="mb-4 leading-relaxed">
                  To exercise your California privacy rights, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>. We will verify your identity before processing your request.
                </p>
              </section>

              {/* Changes to Privacy Policy */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">12. Changes to This Privacy Policy</h2>
                <p className="mb-4 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Posting the new Privacy Policy on this page</li>
                  <li>Updating the "Last Updated" date at the top of this policy</li>
                  <li>Sending you an email notification for material changes (if you have provided an email address)</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page. Your continued use of the Service after any changes constitutes your acceptance of the updated Privacy Policy.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">13. Contact Us</h2>
                <p className="mb-4 leading-relaxed">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
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
                <p className="mb-4 leading-relaxed">
                  For privacy-related complaints, you also have the right to lodge a complaint with your local data protection authority if you are located in the European Economic Area (EEA) or other jurisdictions with similar rights.
                </p>
              </section>

              {/* Footer Note */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  This Privacy Policy is effective as of {lastUpdated} and applies to all users of the DOER Service.
                </p>
              </div>
            </CardContent>
          </Card>
      </div>
      </main>
      <PublicFooter />
    </div>
  )
}
