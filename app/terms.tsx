import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'

const LAST_UPDATED = 'May 2026'
const CONTACT_EMAIL = 'legal@zerobased.ca'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function Important({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.importantBox}>
      <Text style={styles.importantText}>{children}</Text>
    </View>
  )
}

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.meta}>Zerobased · Last updated {LAST_UPDATED}</Text>

      <Body>
        Please read these Terms of Service carefully before using Zerobased. By creating an account or using the app, you agree to be bound by these terms. If you do not agree, do not use Zerobased.
      </Body>

      <Section title="1. Acceptance of Terms">
        <Body>
          These Terms of Service ("Terms") are a legal agreement between you ("you", "user") and Zerobased ("we", "us", "our"). By downloading, accessing, or using the Zerobased application, you confirm that you have read, understood, and agree to these Terms and our Privacy Policy, which is incorporated herein by reference.
        </Body>
        <Body>
          We may update these Terms from time to time. We will notify you of significant changes within the app. Continued use of Zerobased after changes are posted constitutes acceptance of the updated Terms.
        </Body>
      </Section>

      <Section title="2. What Zerobased Is">
        <Body>
          Zerobased is a personal budgeting and financial organization application. It helps you track income, manage expenses, monitor account balances, debts and assets, and work toward financial goals using a zero-based budgeting approach.
        </Body>
        <Body>
          Zerobased is a software tool. It is not a bank, financial institution, investment platform, credit union, or licensed financial advisory service.
        </Body>
      </Section>

      <Section title="3. Not Financial Advice">
        <Important>
          IMPORTANT: Zerobased is not a licensed financial advisor and does not provide personalized financial advice.
        </Important>
        <Body>
          Any tips, insights, educational content, or suggestions provided within the Zerobased app — including content related to debt repayment strategies, savings approaches, budgeting principles, or investment concepts — are provided for general informational and educational purposes only.
        </Body>
        <Body>
          This content reflects commonly cited financial principles and general best practices shared widely by financial educators and institutions. It does not take into account your specific financial situation, goals, risk tolerance, or individual circumstances, and does not constitute personalized financial advice.
        </Body>
        <Body>
          You should not make significant financial decisions based solely on information provided within Zerobased. Always consult a qualified and licensed financial advisor, accountant, or other financial professional before making major financial decisions.
        </Body>
        <Body>
          Zerobased, its operators, and affiliates are not liable for any financial decisions you make based on information or content within the app.
        </Body>
      </Section>

      <Section title="4. Eligibility">
        <Bullet>You must be at least 18 years of age to use Zerobased</Bullet>
        <Bullet>You must be a resident of Canada or the United States</Bullet>
        <Bullet>You must provide accurate information when creating your account</Bullet>
        <Bullet>You must not have been previously suspended or removed from Zerobased</Bullet>
        <Body>
          By using Zerobased, you confirm that you meet all eligibility requirements above.
        </Body>
      </Section>

      <Section title="5. Your Account">
        <Body>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to:
        </Body>
        <Bullet>Keep your password secure and not share it with anyone</Bullet>
        <Bullet>Notify us immediately at {CONTACT_EMAIL} if you suspect unauthorized access to your account</Bullet>
        <Bullet>Provide accurate and truthful information when setting up your account and budget</Bullet>
        <Bullet>Use Zerobased only for your own personal budgeting purposes</Bullet>
        <Body>
          We are not liable for any loss or damage arising from your failure to keep your account secure.
        </Body>
      </Section>

      <Section title="6. Subscription Plans & Billing">
        <Text style={styles.subTitle}>Free Plan</Text>
        <Body>
          Zerobased offers a free tier with access to core budgeting features including manual expense tracking, over-budget alerts, and up to 8 budget categories.
        </Body>

        <Text style={styles.subTitle}>Zerobased Pro</Text>
        <Body>
          Zerobased Pro is a paid subscription that unlocks additional features including unlimited budget categories, pay cycle budgeting, household sharing, accounts and net worth tracking, detailed reports, and bank connections. Pro is available on a monthly or annual basis.
        </Body>

        <Text style={styles.subTitle}>Billing</Text>
        <Body>
          All payments are processed through the Apple App Store. By subscribing to Zerobased Pro, you authorize Apple to charge your Apple ID account on a recurring basis at the selected billing interval (monthly or annual). Zerobased does not directly handle, store, or process your payment card information.
        </Body>

        <Text style={styles.subTitle}>Cancellation</Text>
        <Body>
          You may cancel your Zerobased Pro subscription at any time through your Apple ID account settings. Cancellation takes effect at the end of the current billing period. You will retain Pro access until that date.
        </Body>

        <Text style={styles.subTitle}>Refunds</Text>
        <Body>
          All refund requests are handled by Apple in accordance with their refund policy. Zerobased does not directly issue refunds. To request a refund, visit Apple's Report a Problem page at reportaproblem.apple.com.
        </Body>

        <Text style={styles.subTitle}>Price Changes</Text>
        <Body>
          We reserve the right to change subscription pricing with reasonable advance notice. Price changes will not affect your current billing period and will take effect at the start of your next renewal.
        </Body>
      </Section>

      <Section title="7. Acceptable Use">
        <Body>You agree not to use Zerobased to:</Body>
        <Bullet>Violate any applicable law or regulation</Bullet>
        <Bullet>Impersonate any person or entity or misrepresent your identity</Bullet>
        <Bullet>Attempt to gain unauthorized access to any part of the app or its servers</Bullet>
        <Bullet>Reverse engineer, decompile, or disassemble any part of the app</Bullet>
        <Bullet>Use the app for any commercial purpose without our written consent</Bullet>
        <Bullet>Upload or transmit viruses, malware, or any malicious code</Bullet>
        <Bullet>Use the household sharing feature to grant access to individuals who have not agreed to these Terms</Bullet>
        <Body>
          We reserve the right to suspend or terminate your account if you violate any of the above without prior notice.
        </Body>
      </Section>

      <Section title="8. Third-Party Services">
        <Body>
          Zerobased integrates with the following third-party services to deliver its features. Your use of these integrations is subject to each provider's own terms of service and privacy policy:
        </Body>
        <Bullet>Supabase — data storage and authentication</Bullet>
        <Bullet>RevenueCat — subscription management</Bullet>
        <Bullet>Apple App Store — payment processing</Bullet>
        <Bullet>Plaid — bank account connections (Pro users, optional)</Bullet>
        <Bullet>Expo — push notification delivery</Bullet>
        <Body>
          Zerobased is not responsible for the availability, accuracy, security, or performance of any third-party service. Outages, errors, or data issues originating from third-party providers are outside our control and do not constitute a breach of these Terms.
        </Body>
        <Body>
          When you connect a bank account through Plaid, you are entering into a separate agreement with Plaid. Zerobased receives only the account and transaction data necessary to display within the app and does not store your banking credentials.
        </Body>
      </Section>

      <Section title="9. Accuracy of Financial Data">
        <Body>
          Zerobased displays financial data that you enter manually or that is imported through third-party connections such as Plaid. We do not independently verify the accuracy of any data entered by you or provided by third parties.
        </Body>
        <Body>
          You are solely responsible for the accuracy of the financial information you enter into Zerobased. Zerobased is not responsible for decisions made based on inaccurate, incomplete, or outdated data within the app.
        </Body>
      </Section>

      <Section title="10. Intellectual Property">
        <Body>
          All content, design, code, branding, logos, and features within the Zerobased application are owned by or licensed to Zerobased and are protected by applicable intellectual property laws.
        </Body>
        <Body>
          You retain full ownership of the financial data you enter into Zerobased. You grant us a limited licence to store and process that data solely for the purpose of providing the service to you. We do not claim ownership of your personal financial data.
        </Body>
        <Body>
          You may not copy, reproduce, modify, distribute, or create derivative works from any part of Zerobased without our express written permission.
        </Body>
      </Section>

      <Section title="11. Disclaimer of Warranties">
        <Important>
          Zerobased is provided "as is" and "as available" without warranties of any kind, either express or implied.
        </Important>
        <Body>
          To the fullest extent permitted by applicable law, Zerobased expressly disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that:
        </Body>
        <Bullet>The app will be uninterrupted, error-free, or available at all times</Bullet>
        <Bullet>Any errors or defects will be corrected</Bullet>
        <Bullet>The app or its servers are free of viruses or other harmful components</Bullet>
        <Bullet>The results obtained from using the app will be accurate or reliable</Bullet>
      </Section>

      <Section title="12. Limitation of Liability">
        <Important>
          To the fullest extent permitted by law, Zerobased's total liability to you for any claim arising from your use of the app shall not exceed the greater of (a) the total amount you paid for Zerobased Pro in the twelve months preceding the claim, or (b) $10.00 CAD.
        </Important>
        <Body>
          In no event shall Zerobased be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
        </Body>
        <Bullet>Loss of data or financial information</Bullet>
        <Bullet>Financial losses resulting from budgeting decisions made using the app</Bullet>
        <Bullet>Losses resulting from third-party service failures (Plaid, Supabase, Apple, RevenueCat)</Bullet>
        <Bullet>Unauthorized access to your account</Bullet>
        <Bullet>Any interruption or cessation of service</Bullet>
        <Body>
          Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, our liability is limited to the maximum extent permitted by law.
        </Body>
      </Section>

      <Section title="13. Indemnification">
        <Body>
          You agree to indemnify, defend, and hold harmless Zerobased and its operators, affiliates, and partners from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to:
        </Body>
        <Bullet>Your use of or access to Zerobased</Bullet>
        <Bullet>Your violation of these Terms</Bullet>
        <Bullet>Your violation of any applicable law or regulation</Bullet>
        <Bullet>Financial decisions you make based on content within the app</Bullet>
        <Bullet>Any data you submit, enter, or transmit through the app</Bullet>
      </Section>

      <Section title="14. Termination">
        <Body>
          You may terminate your account at any time by deleting it in Settings. Upon termination, your data will be permanently deleted within 30 days.
        </Body>
        <Body>
          We reserve the right to suspend or terminate your access to Zerobased at any time, with or without notice, if we reasonably believe you have violated these Terms, applicable law, or if we discontinue the service. If we terminate your account without cause, we will provide a prorated refund of any prepaid Pro subscription fees where required by applicable law.
        </Body>
      </Section>

      <Section title="15. Governing Law & Dispute Resolution">
        <Text style={styles.subTitle}>Governing Law</Text>
        <Body>
          These Terms are governed by and construed in accordance with the laws of the Province of Alberta and the federal laws of Canada applicable therein, without regard to conflict of law principles.
        </Body>

        <Text style={styles.subTitle}>Informal Resolution</Text>
        <Body>
          Before initiating any formal dispute, you agree to contact us at {CONTACT_EMAIL} and give us 30 days to attempt to resolve the issue informally. Most concerns can be resolved quickly this way.
        </Body>

        <Text style={styles.subTitle}>Arbitration</Text>
        <Body>
          If informal resolution fails, any dispute, claim, or controversy arising out of or relating to these Terms or your use of Zerobased shall be resolved by binding individual arbitration rather than in court. You agree to waive any right to participate in a class action lawsuit or class-wide arbitration against Zerobased.
        </Body>
        <Body>
          Arbitration shall be conducted in Alberta, Canada. Nothing in this section prevents either party from seeking urgent injunctive or equitable relief from a court of competent jurisdiction.
        </Body>

        <Text style={styles.subTitle}>Exception for Canadian Consumer Rights</Text>
        <Body>
          Nothing in this arbitration clause limits rights you may have under Alberta's Consumer Protection Act or other mandatory consumer protection laws that cannot be waived by agreement.
        </Body>
      </Section>

      <Section title="16. Affiliate Program">
        <Body>
          Zerobased operates an affiliate referral program. If you participate as an affiliate, you agree to promote Zerobased honestly and accurately and not make misleading claims about the app or its features. Affiliate commissions are paid at our discretion in accordance with the current commission structure communicated to you at the time of approval. We reserve the right to modify or terminate the affiliate program at any time with reasonable notice.
        </Body>
      </Section>

      <Section title="17. Severability">
        <Body>
          If any provision of these Terms is found to be unenforceable or invalid by a court of competent jurisdiction, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.
        </Body>
      </Section>

      <Section title="18. Entire Agreement">
        <Body>
          These Terms, together with our Privacy Policy, constitute the entire agreement between you and Zerobased regarding your use of the app and supersede all prior agreements, understandings, or representations.
        </Body>
      </Section>

      <Section title="19. Contact Us">
        <Body>
          If you have any questions about these Terms of Service, please contact us at:
        </Body>
        <Body>{'\n'}{CONTACT_EMAIL}{'\n'}Zerobased{'\n'}Alberta, Canada</Body>
      </Section>

      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
    gap: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: -16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  importantBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f5d97a',
    borderRadius: 10,
    padding: 14,
  },
  importantText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 20,
    fontWeight: '600',
  },
})
