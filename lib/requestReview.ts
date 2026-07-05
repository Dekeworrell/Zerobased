import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

const FIRST_SEEN_KEY = 'review_first_seen';
const LAST_ASKED_KEY = 'review_last_asked';

const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_DAYS_BETWEEN_ASKS = 120;

export async function maybeRequestReview() {
  try {
    if (Platform.OS === 'web') return;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // First time we've ever been called: record it, don't prompt
    const firstSeen = await AsyncStorage.getItem(FIRST_SEEN_KEY);
    if (!firstSeen) {
      await AsyncStorage.setItem(FIRST_SEEN_KEY, String(now));
      return;
    }

    // Too soon after install
    if (now - Number(firstSeen) < MIN_DAYS_SINCE_INSTALL * dayMs) return;

    // Asked too recently
    const lastAsked = await AsyncStorage.getItem(LAST_ASKED_KEY);
    if (lastAsked && now - Number(lastAsked) < MIN_DAYS_BETWEEN_ASKS * dayMs) return;

    if (await StoreReview.hasAction()) {
      await AsyncStorage.setItem(LAST_ASKED_KEY, String(now));
      await StoreReview.requestReview();
    }
  } catch {
    // Never let a review prompt break the app
  }
}