import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState<'expense' | 'income'>('expense')
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

  async function handleSave() {
    if (!amount || !label) {
      setError('Please enter an amount and description')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

    await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: selectedCategory?.id === 'unexpected' ? null : selectedCategory?.id || null,
        label,
        amount: parseFloat(amount),
        date,
        type,
        is_unexpected: selectedCategory?.id === 'unexpected',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
      </View>

      <Text style={styles.fieldLabel}>Amount</Text>
      <CurrencyInput
        style={styles.amountInput}
        placeholder="$0.00"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        placeholderTextColor={Colors.textSecondary}
        value={label}
        onChangeText={setLabel}
        selectTextOnFocus
      />

      <Text style={styles.fieldLabel}>Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.textSecondary}
        value={date}
        onChangeText={setDate}
      />

      {type === 'expense' && (
        <>
          <Text style={styles.fieldLabel}>Category</Text>
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
})