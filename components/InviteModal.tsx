import { useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'
import { invalidateUserCache } from '../lib/userCache'

export default function InviteModal({ visible, onClose, onAccepted }: {
  visible: boolean
  onClose: () => void
  onAccepted: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    if (!code.trim()) { setError('Please enter your invite code'); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.rpc('accept_household_invite', { invite_token: code.trim() })
      if (error) throw error
      invalidateUserCache()
      supabase.functions.invoke('notify-invite-accepted').catch(() => {})
      onAccepted()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📬</Text>
          <Text style={styles.title}>You've been invited!</Text>
          <Text style={styles.subtitle}>
            Your partner invited you to share their budget. Enter the code they gave you to join.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Enter code"
            placeholderTextColor={Colors.textSecondary}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <TouchableOpacity style={[styles.acceptBtn, loading && styles.disabled]} onPress={accept} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.acceptBtnText}>Accept Invite</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Text style={styles.laterText}>I'll do this later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center', gap: 10 },
  emoji: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  input: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: Colors.text, width: '100%', textAlign: 'center', letterSpacing: 2 },
  acceptBtn: { backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center', width: '100%', marginTop: 4 },
  acceptBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  laterText: { color: Colors.textSecondary, fontSize: 14, marginTop: 8 },
})