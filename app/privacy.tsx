import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'

const LAST_UPDATED = 'May 2026'
const CONTACT_EMAIL = 'privacy@zerobased.ca'

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

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.meta}>Zerobased · Last updated {LAST_UPDATED}</Text>

      <Body>
        Your privacy matters to us. This policy explains exactly what data Zerobased collects, why we collect it, who we share it with, and your rights as a user. We have written this in plain language on purpose — if something is unclear, contact us at {CONTACT_EMAIL}.
      </Body>

      <Section title="1. Who We Are">
        <Body>
          Zerobased is a personal budgeting application built for Canadians and Americans. We help you track income, manage expenses, monitor debts and assets, and work toward your financial goals. Zerobased is operated by Deke Worrell ("we", "us", "our").
        </Body>
      </Section>

      <Section title="2. What We Collect">
        <Body>We only collect data that is necessary to provide the service.</Body>

        <Text style={styles.subTitle}>Account Information</Text>
        <Bullet>First name and email address provided at signup</Bullet>
        <Bullet>Encrypted password (we never store it in plain text — handled by Supabase Auth)</Bullet>
        <Bullet>Country selection (Canada or United States)</Bullet>
        <Bullet>Referral or affiliate code, if you entered one at signup</Bullet>

        <Text style={styles.subTitle}>Financial Data (entered by you)</Text>
        <Bullet>Income sources and amounts</Bullet>
        <Bullet>Budget categories and allocated amounts</Bullet>
        <Bullet>Transactions you log manually</Bullet>
        <Bullet>Account balances (chequing, savings, investments, debts, assets)</Bullet>
        <Bullet>Financial goals and timelines</Bullet>

        <Text style={styles.subTitle}>App Preferences</Text>
        <Bullet>Budget cycle setting (monthly or pay cycle)</Bullet>
        <Bullet>Notification preferences and thresholds</Bullet>
        <Bullet>Tracking method (manual or bank-connected)</Bullet>

        <Text style={styles.subTitle}>Push Notification Token</Text>
        <Bullet>If you grant notification permission, we store a device token to send you budget alerts and paycheque reminders. You can disable this at any time in Settings.</Bullet>

        <Text style={styles.subTitle}>Bank Data (Pro users only, optional)</Text>
        <Bullet>If you choose to connect a bank account via Plaid, we receive your account information and transaction history from Plaid. This connection is optional and can be removed at any time.</Bullet>

        <Text style={styles.subTitle}>Affiliate & Referral Data</Text>
        <Bullet>If you were referred by an affiliate, we record which affiliate referred you and whether you upgraded to Pro. This is used solely to calculate and pay affiliate commissions.</Bullet>
      </Section>

      <Section title="3. How We Use Your Data">
        <Bullet>To provide and operate the Zerobased app and all its features</Bullet>
        <Bullet>To calculate your budget, track spending, and generate reports and insights</Bullet>
        <Bullet>To personalize your experience — for example, surfacing relevant financial tips or educational content based on your spending patterns. This personalization happens within the app and your data is never shared with advertisers for this purpose.</Bullet>
        <Bullet>To send push notifications for budget alerts and paycheque reminders (only if you grant permission)</Bullet>
        <Bullet>To manage your subscription and verify your Pro status</Bullet>
        <Bullet>To process and track affiliate referrals and commissions</Bullet>
        <Bullet>To respond to support requests or account inquiries</Bullet>
      </Section>

      <Section title="4. What We Do Not Do">
        <Bullet>We do not sell your data to anyone, ever</Bullet>
        <Bullet>We do not share your financial data with advertisers</Bullet>
        <Bullet>We do not use your data for advertising targeting</Bullet>
        <Bullet>We do not use third-party advertising SDKs or tracking pixels</Bullet>
        <Bullet>We do not see or store your payment card details — all payments are processed by Apple and managed through RevenueCat</Bullet>
      </Section>

      <Section title="5. Third Parties We Use">
        <Body>We use the following third-party services to operate Zerobased. Each has their own privacy policy.</Body>

        <Text style={styles.subTitle}>Supabase (supabase.com)</Text>
        <Body>All user data is stored in Supabase's secure cloud database, hosted in the United States. Supabase handles authentication and database storage. Data is encrypted in transit (TLS) and at rest.</Body>

        <Text style={styles.subTitle}>RevenueCat (revenuecat.com)</Text>
        <Body>We use RevenueCat to manage Pro subscriptions and verify purchase status. RevenueCat receives your anonymous app user ID and subscription state.</Body>

        <Text style={styles.subTitle}>Apple App Store</Text>
        <Body>All payments are processed directly by Apple. We never receive or store your payment card details. Apple's privacy policy applies to all transactions.</Body>

        <Text style={styles.subTitle}>Plaid (plaid.com) — Pro users only</Text>
        <Body>If you choose to connect a bank account, Plaid acts as the secure intermediary between Zerobased and your bank. Plaid's privacy policy governs how they handle your banking credentials. We receive only the account and transaction data needed to display in the app.</Body>

        <Text style={styles.subTitle}>Expo (expo.dev)</Text>
        <Body>We use Expo's push notification infrastructure to deliver budget alerts and paycheque reminders to your device.</Body>
      </Section>

      <Section title="6. Household Sharing">
        <Body>
          If you invite a household partner, they will be able to see your shared budget categories, transactions, and account balances within the app. You control who you invite and can remove household members at any time in Settings. Household members do not have access to your login credentials or personal profile information.
        </Body>
      </Section>

      <Section title="7. Data Storage & Security">
        <Bullet>Your data is stored on Supabase servers located in the United States</Bullet>
        <Bullet>All data is encrypted in transit using TLS and encrypted at rest</Bullet>
        <Bullet>We use row-level security to ensure users can only access their own data</Bullet>
        <Bullet>We do not store your banking credentials — Plaid handles this securely if you connect a bank</Bullet>
      </Section>

      <Section title="8. Your Rights">
        <Body>You have the following rights regarding your personal data:</Body>
        <Bullet>Access — you can view all your data within the app at any time</Bullet>
        <Bullet>Correction — you can update your information in Settings</Bullet>
        <Bullet>Deletion — you can delete your account and all associated data by tapping "Delete account" in Settings. Data is permanently removed within 30 days.</Bullet>
        <Bullet>Notification opt-out — you can disable push notifications at any time in Settings or your device settings</Bullet>
        <Bullet>Bank disconnection — you can remove your bank connection at any time in Settings (Pro users)</Bullet>
        <Bullet>Data export — to request a copy of your data, email us at {CONTACT_EMAIL}</Bullet>
      </Section>

      <Section title="9. Children's Privacy">
        <Body>
          Zerobased is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.
        </Body>
      </Section>

      <Section title="10. Governing Law">
        <Body>
          Zerobased is operated from Canada and this Privacy Policy is governed by the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws. Users in the United States are also protected under this policy.
        </Body>
      </Section>

      <Section title="11. Changes to This Policy">
        <Body>
          We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. For significant changes, we will notify you within the app. Continued use of Zerobased after changes are posted constitutes your acceptance of the updated policy.
        </Body>
      </Section>

      <Section title="12. Contact Us">
        <Body>
          If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:
        </Body>
        <Body>{'\n'}{CONTACT_EMAIL}</Body>
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
})
