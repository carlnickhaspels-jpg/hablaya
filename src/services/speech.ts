import * as Speech from 'expo-speech';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE API INTEGRATIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SPEECH-TO-TEXT (Deepgram):
 * ```ts
 * import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
 *
 * const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
 *
 * async function transcribeAudio(audioUri: string): Promise<string> {
 *   const { result } = await deepgram.listen.prerecorded.transcribeFile(
 *     fs.readFileSync(audioUri),
 *     {
 *       model: 'nova-2',
 *       language: 'es',
 *       smart_format: true,
 *       punctuate: true,
 *     }
 *   );
 *   return result?.results?.channels[0]?.alternatives[0]?.transcript ?? '';
 * }
 * ```
 *
 * TEXT-TO-SPEECH (ElevenLabs):
 * ```ts
 * import { ElevenLabsClient } from 'elevenlabs';
 *
 * const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
 *
 * async function generateSpeech(text: string): Promise<string> {
 *   const audio = await elevenlabs.generate({
 *     voice: 'Rachel', // or a Spanish-speaking voice ID
 *     text,
 *     model_id: 'eleven_multilingual_v2',
 *   });
 *   // Save audio buffer to a local file and return the URI
 *   const uri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
 *   await FileSystem.writeAsStringAsync(uri, audio, { encoding: 'base64' });
 *   return uri;
 * }
 * ```
 *
 * RECORDING (expo-av):
 * ```ts
 * import { Audio } from 'expo-av';
 *
 * let recording: Audio.Recording | null = null;
 *
 * async function startRealRecording() {
 *   await Audio.requestPermissionsAsync();
 *   await Audio.setAudioModeAsync({
 *     allowsRecordingIOS: true,
 *     playsInSilentModeIOS: true,
 *   });
 *   recording = new Audio.Recording();
 *   await recording.prepareToRecordAsync(
 *     Audio.RecordingOptionsPresets.HIGH_QUALITY
 *   );
 *   await recording.startAsync();
 * }
 *
 * async function stopRealRecording(): Promise<string> {
 *   if (!recording) throw new Error('No active recording');
 *   await recording.stopAndUnloadAsync();
 *   const uri = recording.getURI();
 *   recording = null;
 *   return uri ?? '';
 * }
 * ```
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mockUserUtterances: string[] = [
  'Hola, me llamo Carlos y soy de Estados Unidos.',
  'Sí, me gusta mucho viajar. He visitado México dos veces.',
  'Quiero practicar mi español porque voy a ir a Colombia el próximo mes.',
  'Me gustan los tacos y las enchiladas. La comida mexicana es mi favorita.',
  'Trabajo como ingeniero de software en una empresa grande.',
  'El fin de semana pasado fui al parque con mis amigos.',
  'No entiendo muy bien. ¿Puedes repetir más despacio, por favor?',
  'Creo que el español es un idioma muy bonito y musical.',
  'Mi pasatiempo favorito es leer libros y ver películas en español.',
  'Estoy un poco nervioso pero quiero seguir practicando.',
  'Ayer comí en un restaurante nuevo y la comida estaba deliciosa.',
  'Me gustaría aprender más vocabulario sobre viajes y turismo.',
  'Prefiero el café con leche por la mañana.',
  'Tengo dos hermanos y una hermana. Mi familia es muy unida.',
  'Estoy aprendiendo español desde hace seis meses.',
  'Necesito hablar mejor para mi trabajo. Tenemos clientes en México.',
  'El clima aquí es muy diferente al de mi país.',
  'Me encanta la música latina, especialmente la salsa y el reggaetón.',
  'Los fines de semana me gusta cocinar platos nuevos.',
  'Todavía me cuesta trabajo conjugar los verbos en pasado.',
];

let utteranceIndex = 0;

export async function startRecording(): Promise<void> {
  console.log('[Speech] Recording started');
}

export async function stopRecording(): Promise<string> {
  console.log('[Speech] Recording stopped');
  const text = mockUserUtterances[utteranceIndex % mockUserUtterances.length];
  utteranceIndex += 1;
  return text;
}

export async function playAudio(text: string): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }

  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language: 'es-MX',
      rate: 0.9,
      pitch: 1.0,
      onDone: () => resolve(),
      onError: (error) => reject(error),
    });
  });
}

export async function stopAudio(): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }
}

export async function getSpeechToTextResult(audioUri: string): Promise<string> {
  console.log('[Speech] Processing audio from:', audioUri);
  const text = mockUserUtterances[utteranceIndex % mockUserUtterances.length];
  utteranceIndex += 1;
  return text;
}
