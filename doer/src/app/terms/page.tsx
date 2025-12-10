'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function TermsPage() {
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
                <CardTitle className="text-2xl sm:text-3xl mb-2">Terms of Service</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last Updated: {lastUpdated}
                </p>
              </CardHeader>
              <CardContent className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
              {/* Introduction */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">1. Acceptance of Terms</h2>
                <p className="mb-4 leading-relaxed">
                  By accessing or using DOER ("the Service"), available at usedoer.com, you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you may not access or use the Service.
                </p>
                <p className="mb-4">
                  DOER is operated from Seattle, Washington, United States. These Terms constitute a legally binding agreement between you and DOER.
                </p>
                <p className="mb-4">
                  If you have any questions about these Terms, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>.
                </p>
              </section>

              {/* Service Description */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">2. Service Description</h2>
                <p className="mb-4 leading-relaxed">
                  DOER is an AI-powered platform that transforms goals into structured, actionable plans. The Service includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>AI-powered plan generation from natural language goals</li>
                  <li>Task management and scheduling capabilities</li>
                  <li>Calendar integrations with Google Calendar, Outlook, and Apple Calendar</li>
                  <li>Progress tracking and analytics</li>
                  <li>Automated scheduling and rescheduling features</li>
                  <li>Integration with third-party tools and services</li>
                </ul>
                <p className="mb-4">
                  We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.
                </p>
              </section>

              {/* User Accounts */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">3. User Accounts</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.1 Account Creation</h3>
                <p className="mb-4 leading-relaxed">
                  To use certain features of the Service, you must create an account by providing:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>A valid email address</li>
                  <li>A secure password</li>
                  <li>Any other information requested during registration</li>
                </ul>
                <p className="mb-4">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.2 Account Eligibility</h3>
                <p className="mb-4">
                  You must be at least 13 years old to use the Service. If you are between 13 and 18 years old, you must have your parent's or guardian's permission to use the Service.
                </p>
                <p className="mb-4">
                  You represent and warrant that:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>You have the legal capacity to enter into these Terms</li>
                  <li>All information you provide is accurate, current, and complete</li>
                  <li>You will maintain and update your information as necessary</li>
                  <li>You will not create multiple accounts to circumvent service limitations</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">3.3 Account Security</h3>
                <p className="mb-4">
                  You are responsible for:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Maintaining the security of your account password</li>
                  <li>Notifying us immediately of any unauthorized access or use of your account</li>
                  <li>Using a strong, unique password</li>
                  <li>Logging out of your account when using shared devices</li>
                </ul>
              </section>

              {/* Acceptable Use */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">4. Acceptable Use</h2>
                <p className="mb-4">You agree not to use the Service to:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Violate any applicable laws, regulations, or third-party rights</li>
                  <li>Generate, upload, or share content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
                  <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with any person or entity</li>
                  <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
                  <li>Attempt to gain unauthorized access to any portion of the Service, other accounts, or computer systems</li>
                  <li>Use automated systems (bots, scrapers, etc.) to access the Service without our express written permission</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Remove, circumvent, or modify any copyright notices, trademarks, or other proprietary rights notices</li>
                  <li>Use the Service to generate plans or content that promotes illegal activities, violence, discrimination, or harm</li>
                  <li>Resell, redistribute, or sublicense access to the Service without our written consent</li>
                  <li>Use the Service in any manner that could damage, disable, overburden, or impair our servers or networks</li>
                </ul>
                <p className="mb-4">
                  We reserve the right to investigate violations of these Terms and may involve law enforcement authorities in prosecuting users who violate applicable laws.
                </p>
              </section>

              {/* Intellectual Property */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">5. Intellectual Property Rights</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.1 Our Intellectual Property</h3>
                <p className="mb-4">
                  The Service, including its original content, features, functionality, design, logos, and trademarks, is owned by DOER and protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
                <p className="mb-4">
                  You may not copy, modify, distribute, sell, or lease any part of the Service or included software, nor may you reverse engineer or attempt to extract the source code of that software, except as expressly permitted by law.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.2 Your Content</h3>
                <p className="mb-4">
                  You retain ownership of any content you create, upload, or submit through the Service, including goals, plans, tasks, and other data ("Your Content").
                </p>
                <p className="mb-4">
                  By using the Service, you grant DOER a worldwide, non-exclusive, royalty-free license to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Use, store, and process Your Content to provide and improve the Service</li>
                  <li>Generate AI-powered plans and suggestions based on Your Content</li>
                  <li>Share Your Content with third-party integrations you authorize (e.g., Google Calendar)</li>
                  <li>Create anonymized, aggregated data for analytics and service improvement (with your explicit consent via privacy preferences)</li>
                </ul>
                <p className="mb-4">
                  You represent and warrant that you have all necessary rights to grant these licenses and that Your Content does not violate any third-party rights.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.3 AI-Generated Content</h3>
                <p className="mb-4">
                  Plans, tasks, and other content generated by our AI systems are provided for your use. You own the plans and tasks generated for your account, subject to these Terms. However, the underlying AI models, algorithms, and technology remain our intellectual property.
                </p>
              </section>

              {/* Payment Terms */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">6. Payment Terms</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.1 Subscription Plans</h3>
                <p className="mb-4">
                  DOER offers both free and paid subscription plans. Paid plans are billed on a monthly or annual basis, as selected during checkout.
                </p>
                <p className="mb-4">
                  Subscription fees are charged in advance for the billing period. All fees are non-refundable except as required by law or as explicitly stated in our refund policy.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.2 Payment Processing</h3>
                <p className="mb-4">
                  Payments are processed through Stripe, a third-party payment processor. By providing payment information, you agree to Stripe's terms and conditions. We do not store your full payment card details.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.3 Price Changes</h3>
                <p className="mb-4">
                  We reserve the right to modify subscription prices at any time. Price changes will not affect your current billing period but will apply to subsequent renewal periods. We will provide at least 30 days' notice of any price increases.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.4 Automatic Renewal</h3>
                <p className="mb-4">
                  Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date. You can cancel your subscription at any time through your account settings or by contacting us.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">6.5 Refunds</h3>
                <p className="mb-4">
                  Refunds are provided at our discretion and in accordance with applicable law. If you believe you are entitled to a refund, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>.
                </p>
              </section>

              {/* Termination */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">7. Termination</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.1 Termination by You</h3>
                <p className="mb-4">
                  You may terminate your account at any time by deleting your account through your account settings or by contacting us. Upon termination, your access to the Service will cease immediately.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.2 Termination by Us</h3>
                <p className="mb-4">
                  We may suspend or terminate your account immediately, without prior notice, if:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>You violate these Terms or our Acceptable Use Policy</li>
                  <li>You engage in fraudulent, illegal, or harmful activities</li>
                  <li>We are required to do so by law or court order</li>
                  <li>You fail to pay subscription fees when due</li>
                  <li>We discontinue the Service or your subscription plan</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">7.3 Effect of Termination</h3>
                <p className="mb-4">
                  Upon termination:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Your right to access and use the Service will immediately cease</li>
                  <li>We may delete your account and all associated data, subject to our data retention policies</li>
                  <li>You will not be entitled to any refund of fees paid</li>
                  <li>Provisions that by their nature should survive termination will remain in effect</li>
                </ul>
              </section>

              {/* Limitation of Liability */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">8. Limitation of Liability</h2>
                <p className="mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DOER AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Your use or inability to use the Service</li>
                  <li>Any conduct or content of third parties on the Service</li>
                  <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                  <li>Any errors or omissions in the Service's content or functionality</li>
                  <li>Any interruption or cessation of transmission to or from the Service</li>
                </ul>
                <p className="mb-4">
                  IN NO EVENT SHALL DOER'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM, OR $100, WHICHEVER IS GREATER.
                </p>
                <p className="mb-4">
                  Some jurisdictions do not allow the exclusion or limitation of certain damages, so the above limitations may not apply to you.
                </p>
              </section>

              {/* Disclaimers */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">9. Disclaimers</h2>
                <p className="mb-4">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p className="mb-4">
                  We do not warrant that:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>The Service will be uninterrupted, secure, or error-free</li>
                  <li>Any defects or errors will be corrected</li>
                  <li>The Service is free of viruses or other harmful components</li>
                  <li>The results obtained from using the Service will meet your requirements</li>
                </ul>
                <p className="mb-4">
                  AI-generated plans and suggestions are provided for informational purposes and should not be considered professional advice. You are responsible for evaluating the appropriateness and accuracy of any AI-generated content for your specific situation.
                </p>
              </section>

              {/* Dispute Resolution */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">10. Dispute Resolution</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">10.1 Governing Law</h3>
                <p className="mb-4">
                  These Terms shall be governed by and construed in accordance with the laws of the State of Washington, United States, without regard to its conflict of law provisions.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">10.2 Informal Resolution</h3>
                <p className="mb-4">
                  Before filing a formal legal claim, you agree to contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a> to attempt to resolve the dispute informally. We will attempt to resolve disputes in good faith within 60 days.
                </p>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">10.3 Binding Arbitration</h3>
                <p className="mb-4">
                  If we cannot resolve a dispute informally, you agree that any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in Seattle, Washington, in accordance with the rules of the American Arbitration Association.
                </p>
                <p className="mb-4">
                  You waive your right to a jury trial and to participate in class action lawsuits. However, you retain the right to bring individual claims in small claims court if your claims qualify.
                </p>
              </section>

              {/* Third-Party Services */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">11. Third-Party Services</h2>
                <p className="mb-4">
                  The Service may integrate with or link to third-party services, including but not limited to Google Calendar, Outlook, Apple Calendar, Stripe, and OpenAI. Your use of these third-party services is subject to their respective terms of service and privacy policies.
                </p>
                <p className="mb-4">
                  We are not responsible for the availability, accuracy, or content of third-party services. Your interactions with third-party services are solely between you and the third party.
                </p>
              </section>

              {/* Changes to Terms */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">12. Changes to These Terms</h2>
                <p className="mb-4">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Posting the updated Terms on this page</li>
                  <li>Updating the "Last Updated" date</li>
                  <li>Sending you an email notification (if you have provided an email address)</li>
                </ul>
                <p className="mb-4">
                  Your continued use of the Service after any changes constitutes your acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service and terminate your account.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">13. Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about these Terms of Service, please contact us:
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
                  These Terms of Service are effective as of {lastUpdated} and apply to all users of the DOER Service.
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
