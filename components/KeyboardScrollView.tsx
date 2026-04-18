import { Platform, ScrollView } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

type Props = {
  style?: any
  contentContainerStyle?: any
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled'
  children: React.ReactNode
}

export default function KeyboardScrollView({ style, contentContainerStyle, keyboardShouldPersistTaps, children }: Props) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {children}
      </ScrollView>
    )
  }

  return (
    <KeyboardAwareScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </KeyboardAwareScrollView>
  )
}