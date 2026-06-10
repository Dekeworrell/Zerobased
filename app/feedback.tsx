import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useState } from 'react'
import {
    ActivityIndicator, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

export default function FeedbackScreen() {
  const [type, setType] = useState<'bug' | 'suggestion'>('bug')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!message.trim()) {
      setError('Please enter a message before submitting.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('feedback').insert({
        user_id: user?.id,
        type,
        message: message.trim(),
        app_version: Constants.expoConfig?.version || '1.0.0',
      })
      if (err) throw err
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>🙏</Text>
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successBody}>
            {type === 'bug'
              ? 'Your bug report has been submitted. We will look into it.'
          : 'Your suggestion has been received. We read every one.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">

      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Share Feedback</Text>
      <Text style={styles.subtitle}>
        Help us make Zerobased better. We read every submission.
      </Text>

      <Text style={styles.label}>What kind of feedback is this?</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'bug' && styles.typeBtnActive]}
          onPress={() => setType('bug')}
        >
          <Text style={styles.typeEmoji}>🐛</Text>
          <Text style={[styles.typeLabel, type === 'bug' && styles.typeLabelActive]}>
            Bug Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'suggestion' && styles.typeBtnActive]}
          onPress={() => setType('suggestion')}
        >
          <Text style={styles.typeEmoji}>💡</Text>
          <Text style={[styles.typeLabel, type === 'suggestion' && styles.typeLabelActive]}>
            Suggestion
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>
        {type === 'bug' ? 'Describe the bug' : 'Describe your idea'}
      </Text>
      <TextInput
        style={styles.textArea}
        placeholder={type === 'bug'
          ? 'What happened? What did you expect to happen?'
          : 'What would make Zerobased better for you?'}
        placeholderTextColor={Colors.textSecondary}
        multiline
        numberOfLines={6}
        value={message}
        onChangeText={setMessage}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryBtn, saving && styles.disabled]}
        onPress={handleSubmit}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>Submit</Text>}
      </TouchableOpacity>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: 24, paddingTop: 60,
    maxWidth: 600, alignSelf: 'center', width: '100%', gap: 16
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginTop: -8 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 6
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 24 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: Colors.primary },
  textArea: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 16, fontSize: 15, color: Colors.text,
    minHeight: 140, lineHeight: 22
  },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary, paddingVertical: 16,
    borderRadius: 14, alignItems: 'center', marginTop: 4
  },
  disabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16
  },
  successEmoji: { fontSize: 52 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  successBody: {
    fontSize: 15, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22
  },
})