/**
 * Persoonlijke voorkeuren van de leerling, opgeslagen op het toestel (AsyncStorage).
 *
 * - tutor: wie het gesprek voert (Carlos of María)
 * - correction: hoe streng de tutor corrigeert
 *
 * Bij een leesfout of onbekende waarde geldt de standaard.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type TutorId = 'carlos' | 'maria';
export type CorrectionId = 'all' | 'important' | 'flow';

export interface Preferences {
  tutor: TutorId;
  correction: CorrectionId;
}

export const DEFAULT_TUTOR: TutorId = 'carlos';
export const DEFAULT_CORRECTION: CorrectionId = 'important';

export const TUTOR_NAMES: Record<TutorId, string> = {
  carlos: 'Carlos',
  maria: 'María',
};

const TUTOR_KEY = '@hablaya_pref_tutor';
const CORRECTION_KEY = '@hablaya_pref_correction';

export async function getTutor(): Promise<TutorId> {
  try {
    const value = await AsyncStorage.getItem(TUTOR_KEY);
    return value === 'carlos' || value === 'maria' ? value : DEFAULT_TUTOR;
  } catch {
    return DEFAULT_TUTOR;
  }
}

export async function setTutor(tutor: TutorId): Promise<void> {
  try {
    await AsyncStorage.setItem(TUTOR_KEY, tutor);
  } catch {
    // Opslaan mislukt: de keuze geldt dan alleen tot de app sluit.
  }
}

export async function getCorrection(): Promise<CorrectionId> {
  try {
    const value = await AsyncStorage.getItem(CORRECTION_KEY);
    return value === 'all' || value === 'important' || value === 'flow' ? value : DEFAULT_CORRECTION;
  } catch {
    return DEFAULT_CORRECTION;
  }
}

export async function setCorrection(correction: CorrectionId): Promise<void> {
  try {
    await AsyncStorage.setItem(CORRECTION_KEY, correction);
  } catch {
    // Opslaan mislukt: de keuze geldt dan alleen tot de app sluit.
  }
}

export async function getPreferences(): Promise<Preferences> {
  const [tutor, correction] = await Promise.all([getTutor(), getCorrection()]);
  return { tutor, correction };
}
