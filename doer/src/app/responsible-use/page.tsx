'use client'

import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function ResponsibleUsePage() {
  const lastUpdated = 'January 2025'
  const contactEmail = 'help@usedoer.com'

  // Animation hook
  const cardAnim = useScrollAnimation({ delay: 0, triggerOnce: true })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card
          ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
          className={`scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
        >
            <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl mb-2">Responsible Use Policy</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                Last Updated: {lastUpdated}
              </p>
            </CardHeader>
              <CardContent className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
              {/* Introduction */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">1. Our Commitment to Responsible AI</h2>
                <p className="mb-4 leading-relaxed">
                  DOER is committed to promoting the responsible and ethical use of artificial intelligence. This Responsible Use Policy outlines our expectations for how users should interact with our AI-powered platform and helps ensure that DOER is used in ways that are beneficial, ethical, and aligned with our values.
                </p>
                <p className="mb-4 leading-relaxed">
                  By using DOER, you agree to use the Service in accordance with this policy. Violations of this policy may result in suspension or termination of your account.
                </p>
                <p className="mb-4 leading-relaxed">
                  If you have questions about this policy or need to report a violation, please contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a>.
                </p>
              </section>

              {/* AI Ethics */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">2. AI Ethics and Principles</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.1 Human-Centered Design</h3>
                <p className="mb-4 leading-relaxed">
                  DOER is designed to augment human decision-making, not replace it. Our AI provides suggestions and plans, but you maintain full control and responsibility for:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Reviewing and validating AI-generated plans before implementation</li>
                  <li>Making final decisions about your goals and tasks</li>
                  <li>Adjusting plans based on your judgment and circumstances</li>
                  <li>Ensuring plans align with your values and ethical standards</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.2 Transparency and Accountability</h3>
                <p className="mb-4 leading-relaxed">
                  We believe in transparency about how our AI works:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>We clearly indicate when content is AI-generated</li>
                  <li>You can see and modify all AI-generated plans and tasks</li>
                  <li>We provide information about our AI models and their limitations</li>
                  <li>We are accountable for the AI systems we deploy</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">2.3 Fairness and Non-Discrimination</h3>
                <p className="mb-4 leading-relaxed">
                  We are committed to building AI systems that are fair and do not discriminate:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>We work to identify and mitigate biases in our AI models</li>
                  <li>We do not use AI to discriminate against individuals or groups</li>
                  <li>We provide equal access to our Service regardless of background</li>
                  <li>We continuously monitor and improve our systems for fairness</li>
                </ul>
              </section>

              {/* Prohibited Uses */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">3. Prohibited Uses</h2>
                <p className="mb-4 leading-relaxed">
                  You may not use DOER to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Generate Harmful Content:</strong> Create plans, tasks, or content that promotes violence, illegal activities, self-harm, or harm to others</li>
                  <li><strong>Discrimination:</strong> Use the Service to discriminate against individuals or groups based on protected characteristics (race, religion, gender, sexual orientation, etc.)</li>
                  <li><strong>Deception:</strong> Generate misleading, false, or fraudulent content intended to deceive others</li>
                  <li><strong>Impersonation:</strong> Create content that impersonates individuals, organizations, or entities without authorization</li>
                  <li><strong>Spam and Abuse:</strong> Use the Service to generate spam, unsolicited communications, or to abuse other users</li>
                  <li><strong>Intellectual Property Violations:</strong> Generate content that infringes on copyrights, trademarks, or other intellectual property rights</li>
                  <li><strong>Privacy Violations:</strong> Use the Service to process or generate content using others' personal information without consent</li>
                  <li><strong>Automated Abuse:</strong> Use bots, scripts, or automated systems to abuse the Service or circumvent usage limits</li>
                  <li><strong>Circumventing Safety Measures:</strong> Attempt to bypass, disable, or circumvent our safety filters, content policies, or usage limits</li>
                  <li><strong>Malicious Activities:</strong> Use the Service as part of any malicious, fraudulent, or illegal scheme</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  This list is not exhaustive. We reserve the right to determine what constitutes prohibited use on a case-by-case basis.
                </p>
              </section>

              {/* Content Guidelines */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">4. Content Guidelines</h2>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.1 Appropriate Content</h3>
                <p className="mb-4 leading-relaxed">
                  When using DOER, ensure that your goals, plans, and tasks:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Are legal and comply with applicable laws and regulations</li>
                  <li>Respect the rights and dignity of others</li>
                  <li>Do not promote harmful or dangerous activities</li>
                  <li>Are appropriate for a professional productivity platform</li>
                  <li>Do not contain sensitive personal information about others without consent</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.2 Professional Use</h3>
                <p className="mb-4 leading-relaxed">
                  DOER is designed for legitimate goal achievement and productivity. Examples of appropriate use include:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Personal development and skill building</li>
                  <li>Project planning and task management</li>
                  <li>Educational goals and learning plans</li>
                  <li>Health and wellness objectives</li>
                  <li>Professional development and career goals</li>
                  <li>Creative projects and hobbies</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">4.3 Content Moderation</h3>
                <p className="mb-4 leading-relaxed">
                  We may review content generated through our Service to ensure compliance with this policy. We reserve the right to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Remove or block content that violates this policy</li>
                  <li>Suspend or terminate accounts that repeatedly violate our policies</li>
                  <li>Report illegal content to appropriate authorities</li>
                  <li>Use automated systems to detect policy violations</li>
                </ul>
              </section>

              {/* User Responsibilities */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">5. User Responsibilities</h2>
                <p className="mb-4 leading-relaxed">
                  As a user of DOER, you are responsible for:
                </p>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.1 Reviewing AI Output</h3>
                <p className="mb-4 leading-relaxed">
                  AI-generated content may contain errors, biases, or inappropriate suggestions. You must:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Review all AI-generated plans and tasks before using them</li>
                  <li>Verify that suggestions are appropriate for your situation</li>
                  <li>Use your judgment to modify or reject AI suggestions when necessary</li>
                  <li>Not rely solely on AI output for critical decisions</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.2 Ethical Decision-Making</h3>
                <p className="mb-4 leading-relaxed">
                  You are responsible for ensuring that your use of DOER:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Complies with all applicable laws and regulations</li>
                  <li>Respects the rights and privacy of others</li>
                  <li>Aligns with ethical standards and your personal values</li>
                  <li>Does not cause harm to yourself or others</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-gray-100">5.3 Reporting Issues</h3>
                <p className="mb-4 leading-relaxed">
                  If you encounter:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Inappropriate or harmful AI-generated content</li>
                  <li>Bias or discrimination in AI outputs</li>
                  <li>Security vulnerabilities or misuse by other users</li>
                  <li>Any other concerns about responsible use</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  Please report them to us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    {contactEmail}
                  </a> or use our{' '}
                  <a href="/report-misuse" className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                    Report Misuse
                  </a> form.
                </p>
              </section>

              {/* AI Limitations */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">6. Understanding AI Limitations</h2>
                <p className="mb-4 leading-relaxed">
                  It is important to understand the limitations of AI systems:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Not Infallible:</strong> AI can make mistakes, provide inaccurate information, or suggest inappropriate actions</li>
                  <li><strong>Context Dependent:</strong> AI may not fully understand your specific context, constraints, or circumstances</li>
                  <li><strong>No Guarantees:</strong> AI-generated plans do not guarantee success or optimal outcomes</li>
                  <li><strong>Human Judgment Required:</strong> AI suggestions should always be reviewed and validated by humans</li>
                  <li><strong>Evolving Technology:</strong> AI systems improve over time but may have limitations we are still addressing</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  Always use your judgment and consult with professionals (doctors, lawyers, financial advisors, etc.) for advice in specialized domains.
                </p>
              </section>

              {/* Enforcement */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">7. Enforcement</h2>
                <p className="mb-4 leading-relaxed">
                  We take violations of this Responsible Use Policy seriously. Enforcement actions may include:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li><strong>Warnings:</strong> For minor or first-time violations, we may issue a warning</li>
                  <li><strong>Content Removal:</strong> Removal of content that violates this policy</li>
                  <li><strong>Temporary Suspension:</strong> Temporary suspension of account access</li>
                  <li><strong>Permanent Termination:</strong> Permanent termination of accounts for serious or repeated violations</li>
                  <li><strong>Legal Action:</strong> Reporting to law enforcement or pursuing legal action for illegal activities</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We reserve the right to take any action we deem necessary to protect our Service, users, and the broader community.
                </p>
              </section>

              {/* Reporting Violations */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">8. Reporting Violations</h2>
                <p className="mb-4 leading-relaxed">
                  If you witness or experience a violation of this Responsible Use Policy, please report it:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>Use our{' '}
                    <a href="/report-misuse" className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      Report Misuse
                    </a> form for detailed reports
                  </li>
                  <li>Email us at{' '}
                    <a href={`mailto:${contactEmail}`} className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      {contactEmail}
                    </a> with "Responsible Use Violation" in the subject line
                  </li>
                  <li>Include as much detail as possible: screenshots, URLs, timestamps, and descriptions</li>
                  <li>We will investigate all reports and take appropriate action</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  We treat all reports confidentially and will not disclose your identity unless required by law.
                </p>
              </section>

              {/* Continuous Improvement */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">9. Continuous Improvement</h2>
                <p className="mb-4 leading-relaxed">
                  We are committed to continuously improving our Responsible Use Policy and AI systems:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 leading-relaxed">
                  <li>We regularly review and update this policy based on feedback and evolving best practices</li>
                  <li>We invest in research and development to improve AI safety and fairness</li>
                  <li>We engage with the AI ethics community and incorporate learnings</li>
                  <li>We monitor our systems for bias, errors, and inappropriate outputs</li>
                  <li>We are transparent about our progress and challenges</li>
                </ul>
                <p className="mb-4 leading-relaxed">
                  Your feedback helps us improve. We encourage you to share your thoughts and concerns about responsible AI use.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">10. Contact Us</h2>
                <p className="mb-4 leading-relaxed">
                  If you have questions about this Responsible Use Policy or need to report a violation, please contact us:
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
                  <p className="mb-2">
                    Report Misuse:{' '}
                    <a href="/report-misuse" className="text-orange-500 hover:text-orange-400 underline min-h-[44px] inline-flex items-center">
                      /report-misuse
                    </a>
                  </p>
                </div>
              </section>

              {/* Footer Note */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  This Responsible Use Policy is effective as of {lastUpdated} and applies to all users of the DOER Service.
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
