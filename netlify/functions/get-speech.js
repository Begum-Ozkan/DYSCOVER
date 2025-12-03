/* === KODLAMA DESTEĞİ - MİNİ BACKEND (get-speech.js) === */

// Sadece yerel test için 'dotenv' kullanılır. Netlify'da buna gerek yok.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const textToSpeech = require('@google-cloud/text-to-speech');

// Anahtarı güvenli bir şekilde ortam değişkenlerinden (Environment Variables) al
// ÖNEMLİ: Bu değişkenin 'GOOGLE_CREDENTIALS' olarak adlandırılması gerekiyor.
let credentials;
try {
  // Netlify'da veya yerelde .env dosyasında, değişken metin olarak saklanır
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (e) {
  console.error("Anahtar ayrıştırılamadı. GOOGLE_CREDENTIALS ortam değişkeninin ayarlandığından emin olun.");
  // Google'ın kütüphanesi, anahtar olmadan da çalışmayı deneyecektir (eğer varsayılan bir gcloud CLI kurulumu varsa)
  // Ama biz JSON kullandığımız için burada credentials'ı manuel ayarlayalım:
  credentials = {}; // Hata durumunda boş obje
}

// Google API istemcisini anahtarımızla başlat
const client = new textToSpeech.TextToSpeechClient({ credentials });

// Netlify fonksiyonunun ana işleyicisi
exports.handler = async (event, context) => {
    // 1. Sadece POST isteklerini kabul et
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 2. Frontend'den (app.js) gelen metni ve dili al
        const { text, lang } = JSON.parse(event.body);

        if (!text || !lang) {
            return { statusCode: 400, body: 'Missing text or lang parameters' };
        }

        // 3. Google API için dili ve sesi yapılandır
        let voiceConfig = {
            languageCode: 'tr-TR',
            name: 'tr-TR-Wavenet-A', // Yüksek kaliteli Türkçe ses
            ssmlGender: 'FEMALE' // Daha spesifik
        };

        if (lang.startsWith('en-')) {
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Wavenet-F', // Yüksek kaliteli İngilizce (Kadın)
                ssmlGender: 'FEMALE'
            };
        }

        const request = {
            input: { text: text },
            voice: voiceConfig,
            audioConfig: { audioEncoding: 'MP3' }, // Sesi MP3 olarak istiyoruz
        };

        // 4. Google API'ye isteği gönder ve sesi al
        const [response] = await client.synthesizeSpeech(request);
        const audioContent = response.audioContent;

        // 5. Ses dosyasını (MP3) metin (Base64) olarak frontend'e geri gönder
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: audioContent.toString('base64') })
        };

    } catch (error) {
        console.error('TTS FONKSİYON HATASI:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};