import DateTimePicker from '@react-native-community/datetimepicker'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

type Category = {
  id: string
  label: string
  icon: string
}

export default function AddTransactionScreen() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(() => {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    return new Date(now.getTime() - offset * 60 * 1000)
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [type, setType] = useState<'expense' | 'income' | 'unexpected'>('expense')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('budget_categories')
      .select('id, label, icon')
      .eq('user_id', user.id)

    if (data) setCategories(data)
    setLoading(false)
  }

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-CA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatDateForDB(d: Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  async function handleSave() {
    if (!amount) {
      setError('Please enter an amount')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: type === 'unexpected' ? null : selectedCategory?.id || null,
        label: label || selectedCategory?.label || 'Transaction',
        amount: parseFloat(amount),
        date: formatDateForDB(date),
        type: type === 'unexpected' ? 'expense' : type,
        is_unexpected: type === 'unexpected',
      })

      router.replace('/dashboard')

    } catch (err: any) {
      setError(err.message)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.push('/dashboard')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add transaction</Text>

      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]}
          onPress={() => setType('expense')}
        >
          <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
            Expense
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]}
          onPress={() => setType('income')}
        >
          <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
            Income
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'unexpected' && styles.typeBtnUnexpectedActive]}
          onPress={() => { setType('unexpected' as any); setSelectedCategory(null) }}
        >
          <Text style={[styles.typeBtnText, type === 'unexpected' && styles.typeBtnTextActive]}>
            ⚠️ Unexpected
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Amount</Text>
      <CurrencyInput
        style={styles.amountInput}
        placeholder="$0.00"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.fieldLabel}>Description (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        placeholderTextColor={Colors.textSecondary}
        value={label}
        onChangeText={setLabel}
        selectTextOnFocus
      />

      <Text style={styles.fieldLabel}>Date</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={formatDateForDB(date)}
          max={formatDateForDB(new Date())}
          onChange={(e) => {
            if (e.target.value) setDate(new Date(e.target.value + 'T12:00:00'))
          }}
          style={{
            backgroundColor: '#1c1c1e',
            border: '1px solid #3a3a3c',
            borderRadius: 12,
            padding: '14px 16px',
            fontSize: 16,
            color: '#ffffff',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>📅  {formatDateDisplay(date)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) setDate(selectedDate)
                if (Platform.OS === 'android') setShowDatePicker(false)
              }}
              maximumDate={new Date()}
            />
          )}
        </>
      )}

      {(type === 'expense' || type === 'unexpected') && (
        <>
          <Text style={styles.fieldLabel}>
            {type === 'unexpected' ? 'What was the unexpected expense for?' : 'Category'}
          </Text>
          {type === 'unexpected' && (
            <View style={styles.unexpectedInfo}>
              <Text style={styles.unexpectedInfoText}>
                ⚠️ Unexpected expenses are tracked separately to help identify spending patterns and improve future budget suggestions.
              </Text>
            </View>
          )}
          <View style={styles.categoryList}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryRow,
                  selectedCategory?.id === cat.id && styles.categoryRowActive
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={styles.categoryRowLeft}>
                  <Text style={styles.categoryRowIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.categoryRowText,
                    selectedCategory?.id === cat.id && styles.categoryRowTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </View>
                {selectedCategory?.id === cat.id && (
                  <Text style={styles.categoryRowCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>Save transaction</Text>
        }
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
  },
  typeBtnText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: Colors.text,
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 20,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  dateButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  categoryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryRowIcon: {
    fontSize: 20,
  },
  categoryRowText: {
    fontSize: 15,
    color: Colors.text,
  },
  categoryRowTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  categoryRowCheck: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  typeBtnUnexpectedActive: {
    backgroundColor: Colors.warning,
  },
  unexpectedInfo: {
    backgroundColor: Colors.warning + '22',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 12,
  },
  unexpectedInfoText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
})