import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const supabaseAnonKey = 'sb_publishable_ly3sjXcnuv5qnQl2YWa7ww_KiWFLMpm'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})