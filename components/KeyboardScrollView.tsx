import React, { forwardRef } from 'react'
import { Platform, ScrollView } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

type Props = {
  style?: any
  contentContainerStyle?: any
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled'
  children: React.ReactNode | React.ReactNode[]
}

const KeyboardScrollView = forwardRef<any, Props>(function KeyboardScrollView({ style, contentContainerStyle, keyboardShouldPersistTaps, children }, ref) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        ref={ref}
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
})

KeyboardScrollView.displayName = 'KeyboardScrollView'

export default KeyboardScrollView