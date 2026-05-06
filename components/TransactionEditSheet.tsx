import DateTimePicker from '@react-native-community/datetimepicker'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { balanceChangeOnExpense, balanceChangeOnIncome } from '../constants/categories'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'
import CurrencyInput from './CurrencyInput'

type Transaction = {
  id: string
  label: string
  amount: number
  date: string
  type: string
  is_unexpected: boolean
  category_id: string | null
  account_id: string | null
  category: { label: string; icon: string } | null
}

type Category = { id: string; label: string; icon: string }

type Props = {
  visible: boolean
  transaction: Transaction | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function TransactionEditSheet({ visible, transaction, categories, onClose, onSaved, onDeleted }: Props) {
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (transaction && visible) {
      setAmount(transaction.amount.toString())
      setLabel(transaction.label)
      setDate(new Date(transaction.date + 'T12:00:00'))
      setSelectedCategoryId(transaction.category_id)
      setShowCategoryPicker(false)
      setShowDatePicker(false)
      setError('')
    }
  }, [transaction?.id, visible])

  function formatDateForDB(d: Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  }

  const selectedCategory = categories.find(c => c.id === selectedCategoryId) || transaction?.category

  async function handleSave() {
    if (!amount) { setError('Please enter an amount'); return }
    setSaving(true)
    setError('')
    try {
      const newAmount = parseFloat(amount)
      const oldAmount = transaction!.amount

      await supabase.from('transactions').update({
        label: label || transaction!.label,
        amount: newAmount,
        date: formatDateForDB(date),
        category_id: selectedCategoryId,
      }).eq('id', transaction!.id)

      if (transaction!.account_id && newAmount !== oldAmount) {
        const { data: acc } = await supabase
          .from('accounts').select('balance, type').eq('id', transaction!.account_id).single()
        if (acc) {
          const current = parseFloat(acc.balance) || 0
          const oldDelta = transaction!.type === 'income'
            ? balanceChangeOnIncome(acc.type, oldAmount)
            : balanceChangeOnExpense(acc.type, oldAmount)
          const newDelta = transaction!.type === 'income'
            ? balanceChangeOnIncome(acc.type, newAmount)
            : balanceChangeOnExpense(acc.type, newAmount)
          const newBalance = current - oldDelta + newDelta
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', transaction!.account_id)
        }
      }
      onSaved()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Delete this transaction? This cannot be undone.')
      : await new Promise<boolean>(resolve =>
          Alert.alert('Delete transaction', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ])
        )
    if (!confirmed) return

    setDeleting(true)
    setError('')
    try {
      if (transaction!.account_id) {
        const { data: acc } = await supabase
          .from('accounts').select('balance, type').eq('id', transaction!.account_id).single()
        if (acc) {
          const current = parseFloat(acc.balance) || 0
          const delta = transaction!.type === 'income'
            ? balanceChangeOnIncome(acc.type, transaction!.amount)
            : balanceChangeOnExpense(acc.type, transaction!.amount)
          const newBalance = current - delta
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', transaction!.account_id)
        }
      }
      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transaction!.id)
      if (deleteError) throw deleteError
      onDeleted()
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose() }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Edit transaction</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Amount</Text>
              <CurrencyInput style={styles.amountInput} placeholder="$0.00" value={amount} onChangeText={setAmount} />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholderTextColor={Colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(!showDatePicker)}>
                <Text style={styles.dateButtonText}>📅 {formatDateDisplay(date)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden', marginTop: 8 }}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    themeVariant="light"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) setDate(selectedDate)
                      if (Platform.OS === 'android') setShowDatePicker(false)
                    }}
                  />
                  <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity style={styles.categoryButton} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                <Text style={styles.categoryButtonText}>
                  {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.label}` : '— None —'}
                </Text>
                <Text style={styles.chevron}>{showCategoryPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.categoryList}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryRow, selectedCategoryId === cat.id && styles.categoryRowActive]}
                      onPress={() => { setSelectedCategoryId(cat.id); setShowCategoryPicker(false) }}
                    >
                      <Text style={styles.categoryRowIcon}>{cat.icon}</Text>
                      <Text style={[styles.categoryRowText, selectedCategoryId === cat.id && styles.categoryRowTextActive]}>{cat.label}</Text>
                      {selectedCategoryId === cat.id && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveBtnText}>Save changes</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.deleteBtn, deleting && styles.disabled]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.deleteBtnText}>🗑  Delete transaction</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: '85%',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  closeBtn: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 12, marginBottom: 6 },
  amountInput: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', paddingVertical: 12 },
  input: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  dateButton: { backgroundColor: '#edf7f1', borderWidth: 1.5, borderColor: '#b6dfc0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  dateButtonText: { fontSize: 15, color: Colors.text },
  doneBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center', margin: 8 },
  doneBtnText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  categoryButton: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryButtonText: { fontSize: 15, color: Colors.text },
  chevron: { fontSize: 11, color: Colors.textSecondary },
  categoryList: { gap: 6, marginTop: 8 },
  categoryRow: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  categoryRowIcon: { fontSize: 18 },
  categoryRowText: { fontSize: 14, color: Colors.text, flex: 1 },
  categoryRowTextActive: { color: Colors.primary, fontWeight: '600' },
  checkmark: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center', marginTop: 8 },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  deleteBtn: { borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: Colors.danger, fontSize: 15, fontWeight: '500' },
})