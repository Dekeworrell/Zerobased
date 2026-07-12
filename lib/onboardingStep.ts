import { supabase } from './supabase'

export async function markOnboardingStep(step: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('id', user.id)
    if (error) console.error('onboarding step save failed:', error)
  } catch (err) {
    console.error('onboarding step save failed:', err)
  }
}