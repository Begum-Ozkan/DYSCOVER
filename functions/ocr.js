/* === functions/ocr.js (Google Vision API ile PDF Okuma) === */
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const fileContent = body.fileContent; // Base64 formatında PDF

        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ error: "API Key bulunamadı." }) };
        }

        // Google Vision API'ye istek (PDF/Document Text Detection)
        // Not: Vision API PDF için genellikle GCS (Storage) ister ama
        // Basit resim/OCR işlemi için TEXT_DETECTION kullanabiliriz.
        // Ancak PDF'i doğrudan base64 gönderip okumak için 'annotate' endpointi görsel (image) bekler.
        // Bu yüzden PDF'in ilk sayfasını veya PDF işleme yeteneğini kullanmalıyız.
        
        // --- ÖNEMLİ NOT ---
        // Google Vision API'nin "files:annotate" metodu normalde Google Cloud Storage gerektirir.
        // Ancak biz burada pratik olması için PDF.js ile PDF'i frontend'de resme çevirip
        // o resmi Google'a gönderirsek (OCR) en temiz sonucu alırız.
        // VEYA burada doğrudan Base64 Image gönderiyormuşuz gibi işlem yapacağız.
        
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [
                    {
                        image: {
                            content: fileContent // Frontend'den gelen Base64 Resim verisi
                        },
                        features: [
                            { type: "DOCUMENT_TEXT_DETECTION" } // Yoğun metinler için en iyisi
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        if (data.responses && data.responses[0].fullTextAnnotation) {
            return {
                statusCode: 200,
                body: JSON.stringify({ text: data.responses[0].fullTextAnnotation.text })
            };
        } else {
            // Metin bulunamadıysa veya hata varsa
            return { 
                statusCode: 200, 
                body: JSON.stringify({ text: "Metin algılanamadı veya dosya formatı desteklenmiyor." }) 
            };
        }

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};