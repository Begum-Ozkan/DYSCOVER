const textToSpeech = require('@google-cloud/text-to-speech');

// Devamında:
let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (e) {
  console.error("Anahtar ayrıştırılamadı. GOOGLE_CREDENTIALS ortam değişkeninin ayarlandığından emin olun.");
  throw e;
}

const client = new textToSpeech.TextToSpeechClient({ credentials });
