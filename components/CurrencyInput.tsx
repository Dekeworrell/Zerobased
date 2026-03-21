import { StyleSheet, TextInput, TextInputProps } from 'react-native'
import { Colors } from '../constants/colors'

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string
  onChangeText: (raw: string) => void
  style?: any
}

export default function CurrencyInput({ value, onChangeText, style, ...props }: Props) {
  function format(raw: string): string {
    const digits = raw.replace(/[^0-9.]/g, '')
    const parts = digits.split('.')
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    if (parts.length > 1) {
      return '$' + whole + '.' + parts[1].slice(0, 2)
    }
    return whole ? '$' + whole : ''
  }

  function handleChange(text: string) {
    const raw = text.replace(/[^0-9.]/g, '')
    onChangeText(raw)
  }

  return (
    <TextInput
      {...props}
      value={format(value)}
      onChangeText={handleChange}
      keyboardType="decimal-pad"
      placeholderTextColor={Colors.textSecondary}
      style={[styles.input, style]}
    />
  )
}

const styles = StyleSheet.create({
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
})