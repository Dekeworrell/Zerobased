import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Index() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setConnected(true)
    })
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{connected ? 'Supabase connected!' : 'Connecting...'}</Text>
    </View>
  )
}