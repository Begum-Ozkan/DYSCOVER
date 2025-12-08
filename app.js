/* === DYSCOVER APP JAVASCRIPT - HYBRID ROBUST PDF === */

// Global Değişkenler
let currentUtterance = null; 
let audioPlayer = new Audio(); 
let isSpeakingTrack = false;
let isSpeakingNatural = false;
let isPaused = false;
let rulerHighlight = null;

// Sesleri Yükle
let voices = [];
function loadVoices() {
    voices = window.speechSynthesis.getVoices();
}
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

// PDF.js Worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', function() {

    // === DOM ELEMENTLERİ ===
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const textInput = document.getElementById('text-input'); 
    const outputBox = document.getElementById('output-box'); 
    const downloadBtn = document.getElementById('download-btn'); 
    
    // Ayarlar
    const fontStyleSelect = document.getElementById('font-style');
    const fontSizeSelect = document.getElementById('font-size');
    const lineSpacingInput = document.getElementById('line-spacing');
    const wordSpacingInput = document.getElementById('word-spacing');
    const letterSpacingInput = document.getElementById('letter-spacing');
    const lineSpacingValue = document.getElementById('line-spacing-value');
    const wordSpacingValue = document.getElementById('word-spacing-value');
    const letterSpacingValue = document.getElementById('letter-spacing-value');
    
    // Kontroller
    const themeInputs = document.querySelectorAll('input[name="theme"]');
    const colorSchemeInputs = document.querySelectorAll('input[name="color-scheme"]');
    const rulerToggle = document.getElementById('reading-ruler');
    const globalSidebar = document.getElementById('global-sidebar');
    const globalToggleBtn = document.getElementById('global-toggle-btn');
    const langSelect = document.getElementById('language');
    const transparentToggle = document.getElementById('transparent-mode');
    
    const btnTrack = document.getElementById('tts-button-track');
    const btnNatural = document.getElementById('tts-button-natural');
    
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');


    // =======================================================
    // 1. PDF & DOCX İŞLEME (GÜVENLİ HİBRİT SİSTEM)
    // =======================================================
    if(fileInput) {
        // Eski dinleyicileri temizlemek için klonlama
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);

        newFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (uploadStatus.textContent.includes("Processing")) {
                console.warn("İşlem zaten sürüyor.");
                return;
            }

            uploadStatus.textContent = "Processing... (AI scanning + Fallback)";
            uploadStatus.style.color = "var(--primary-color)";

            const reader = new FileReader();
            
            reader.onload = async function(ev) {
                const buffer = ev.target.result;
                let finalFullText = '';

                try {
                    if (file.name.endsWith('.pdf')) {
                        const pdf = await pdfjsLib.getDocument({data: buffer}).promise;
                        const totalPages = pdf.numPages;

                        for (let i = 1; i <= totalPages; i++) {
                            uploadStatus.textContent = `Processing page ${i} / ${totalPages}...`;
                            
                            const page = await pdf.getPage(i);
                            
                            // --- YÖNTEM A: YAPAY ZEKA (OCR) ---
                            try {
                                // Scale'i düşürdük (1.2) - Daha küçük resim = Daha hızlı ve hatasız
                                const viewport = page.getViewport({ scale: 1.2 });
                                const canvas = document.createElement('canvas');
                                const context = canvas.getContext('2d');
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;

                                await page.render({ canvasContext: context, viewport: viewport }).promise;

                                // Kaliteyi 0.4'e düşürdük (Veri tasarrufu)
                                const imgBase64 = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];

                                const ocrResponse = await fetch('/.netlify/functions/ocr', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fileContent: imgBase64 })
                                });

                                if (!ocrResponse.ok) {
                                    throw new Error("OCR Failed"); // B Planına git
                                }

                                const ocrData = await ocrResponse.json();
                                if (ocrData.text) {
                                    finalFullText += ocrData.text + "\n\n";
                                } else {
                                    throw new Error("No Text in OCR"); // B Planına git
                                }

                            } catch (ocrError) {
                                // --- YÖNTEM B: STANDART TEXT KATMANI (FALLBACK) ---
                                console.warn(`Sayfa ${i} için OCR başarısız, standart okuma yapılıyor...`);
                                
                                const textContent = await page.getTextContent();
                                const pageText = textContent.items.map(item => item.str).join(' ');
                                finalFullText += pageText + "\n\n";
                            }
                        }

                    } else if (file.name.endsWith('.docx')) {
                        const res = await mammoth.extractRawText({arrayBuffer: buffer});
                        finalFullText = res.value;
                    }

                    // Sonucu Yazdır
                    if(textInput) {
                        textInput.value = finalFullText || "Metin bulunamadı.";
                        applyText();
                        const pasteTab = document.querySelector('.tab-link[data-tab="paste"]');
                        if(pasteTab) pasteTab.click();
                    }
                    
                    uploadStatus.textContent = "Conversion Complete!";
                    uploadStatus.style.color = "green";

                } catch (err) {
                    console.error("GENEL HATA:", err);
                    uploadStatus.textContent = "Error: " + err.message;
                    uploadStatus.style.color = "red";
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }


    // =======================================================
    // 2. AYARLAR & COOKIES
    // =======================================================
    function saveSettings() {
        const settings = {
            fontStyle: fontStyleSelect ? fontStyleSelect.value : '',
            fontSize: fontSizeSelect ? fontSizeSelect.value : '',
            lineSpacing: lineSpacingInput ? lineSpacingInput.value : '',
            wordSpacing: wordSpacingInput ? wordSpacingInput.value : '',
            letterSpacing: letterSpacingInput ? letterSpacingInput.value : '',
            language: langSelect ? langSelect.value : 'en-US',
            theme: document.querySelector('input[name="theme"]:checked')?.value || 'theme-light',
            transparent: transparentToggle ? transparentToggle.checked : false,
            ruler: rulerToggle ? rulerToggle.checked : false
        };
        localStorage.setItem('dyscover_settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('dyscover_settings');
        if (!saved) return;
        
        const s = JSON.parse(saved);
        if(fontStyleSelect) fontStyleSelect.value = s.fontStyle;
        if(fontSizeSelect) fontSizeSelect.value = s.fontSize;
        if(lineSpacingInput) { lineSpacingInput.value = s.lineSpacing; updateSliderValue(lineSpacingInput, lineSpacingValue); }
        if(wordSpacingInput) { wordSpacingInput.value = s.wordSpacing; updateSliderValue(wordSpacingInput, wordSpacingValue); }
        if(letterSpacingInput) { letterSpacingInput.value = s.letterSpacing; updateSliderValue(letterSpacingInput, letterSpacingValue); }
        if(langSelect) langSelect.value = s.language;
        
        const themeRadio = document.querySelector(`input[name="theme"][value="${s.theme}"]`);
        if (themeRadio) { themeRadio.checked = true; changeTheme(s.theme); }

        if(transparentToggle) { 
            transparentToggle.checked = s.transparent; 
            if(s.transparent) {
                document.body.classList.add('interface-transparent');
                if(outputBox) outputBox.style.removeProperty('background-color');
            }
        }

        if(rulerToggle) {
            rulerToggle.checked = s.ruler;
            setupReadingRuler();
        }
    }

    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(input => {
        if(input.id !== 'file-input') {
            input.addEventListener('change', saveSettings);
            input.addEventListener('input', saveSettings);
        }
    });


    // =======================================================
    // 3. TEMA & GÖRÜNÜM
    // =======================================================
    function changeTheme(themeName) {
        document.body.classList.remove('theme-light', 'theme-mint', 'theme-peach', 'theme-soft-dark', 'theme-soft-navy');
        document.body.classList.add(themeName);
        if (outputBox) {
            outputBox.style.removeProperty('background-color');
            outputBox.style.removeProperty('color');
            outputBox.style.removeProperty('border-color');
            colorSchemeInputs.forEach(input => input.checked = false);
        }
    }
    
    if (transparentToggle) {
        transparentToggle.addEventListener('change', function(e) {
            if (e.target.checked) {
                document.body.classList.add('interface-transparent');
                if(outputBox) outputBox.style.removeProperty('background-color');
            } else {
                document.body.classList.remove('interface-transparent');
            }
        });
    }

    themeInputs.forEach(input => {
        input.addEventListener('change', (e) => { if(e.target.checked) changeTheme(e.target.value); });
    });

    colorSchemeInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            if (e.target.checked && outputBox) {
                if(transparentToggle && transparentToggle.checked) transparentToggle.click(); 
                const boxColor = e.target.value;
                const textColor = e.target.getAttribute('data-color');
                outputBox.style.setProperty('background-color', boxColor, 'important');
                if (textColor) outputBox.style.setProperty('color', textColor, 'important');
                outputBox.style.borderColor = 'transparent'; 
            }
        });
    });


    // =======================================================
    // 4. PDF İNDİRME (YATAY, GENİŞ VE TRANSPARAN DESTEKLİ)
    // =======================================================
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (!outputBox) return;
            
            // 1. MEVCUT GÖRÜNÜMÜ ANALİZ ET
            const computedStyle = window.getComputedStyle(outputBox);
            let currentBgColor = computedStyle.backgroundColor;
            
            // TRANSPARAN KONTROLÜ: Eğer şeffafsa, ana tema rengini al
            if (currentBgColor === 'rgba(0, 0, 0, 0)' || currentBgColor === 'transparent') {
                const bodyStyle = window.getComputedStyle(document.body);
                currentBgColor = bodyStyle.backgroundColor;
            }

            // Diğer stilleri al
            const currentColor = computedStyle.color;
            const currentFont = computedStyle.fontFamily;
            
            // 2. ORİJİNAL STİLLERİ SAKLA
            const originalInlineStyles = outputBox.getAttribute('style'); 

            // 3. STİLLERİ ZORLA (PDF İÇİN HAZIRLIK)
            // Rengi mühürle
            outputBox.style.backgroundColor = currentBgColor; 
            outputBox.style.color = currentColor;
            outputBox.style.fontFamily = currentFont;
            
            // Font ve aralık ayarlarını garantile
            if(fontSizeSelect) outputBox.style.fontSize = fontSizeSelect.value + 'px';
            if(lineSpacingInput) outputBox.style.lineHeight = lineSpacingInput.value;
            
            // Kenarlıkları kaldır
            outputBox.style.border = "none";
            outputBox.style.boxShadow = "none";
            
            // ÖNEMLİ: YATAY SAYFA İÇİN GENİŞLİK AYARI
            outputBox.style.width = "100%";       // Sayfayı kapla
            outputBox.style.maxWidth = "none";    // Sınırlamayı kaldır
            outputBox.style.padding = "20px";     // Kenarlardan nefes aldır

            // 4. PDF AYARLARI
            const opt = {
                margin:       10, 
                filename:     'dyscover_document.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: null // Elementin rengini kullan
                },
                // BURASI KRİTİK: 'landscape' = YATAY SAYFA
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
            };

            // 5. BUTON DURUMU
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            downloadBtn.disabled = true;

            // 6. OLUŞTUR VE KAYDET
            html2pdf().set(opt).from(outputBox).save().then(() => {
                
                // --- TEMİZLİK (ESKİ HALİNE DÖN) ---
                if (originalInlineStyles) {
                    outputBox.setAttribute('style', originalInlineStyles);
                } else {
                    outputBox.removeAttribute('style');
                }
                
                // Renk şemasını geri yükle
                const checkedColor = document.querySelector('input[name="color-scheme"]:checked');
                if(checkedColor) {
                    outputBox.style.setProperty('background-color', checkedColor.value, 'important');
                    const textColor = checkedColor.getAttribute('data-color');
                    if(textColor) outputBox.style.setProperty('color', textColor, 'important');
                } else {
                    // Transparan mod açıksa temizle
                    if(transparentToggle && transparentToggle.checked) {
                        outputBox.style.removeProperty('background-color');
                    }
                }

                // Global ayarları tekrar tetikle
                applyStyles();

                // Butonu düzelt
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;

            }).catch(err => {
                console.error("PDF Hatası:", err);
                alert("PDF oluşturulamadı.");
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            });
        });
    }

    // =======================================================
    // 5. TTS SİSTEMİ
    // =======================================================
    function getSpeechText() {
        if (outputBox && outputBox.textContent.trim().length > 0 && !outputBox.textContent.includes("is available in this box")) {
            return outputBox.textContent;
        }
        const heroTitle = document.querySelector('.hero-content h1');
        const heroDesc = document.querySelector('.hero-content p');
        if (heroTitle) {
            return heroTitle.textContent + ". " + (heroDesc ? heroDesc.textContent : "");
        }
        return "Welcome to Dyscover.";
    }

    // Mod 1: Takip
    function toggleTrackRead() {
        if (isSpeakingNatural) stopNaturalRead();
        const icon = btnTrack.querySelector('i');

        if (isSpeakingTrack && !isPaused) {
            window.speechSynthesis.pause();
            isPaused = true;
            icon.className = 'fas fa-play';
            return;
        }
        if (isSpeakingTrack && isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
            icon.className = 'fas fa-pause';
            return;
        }

        window.speechSynthesis.cancel();
        
        const textToRead = getSpeechText();
        currentUtterance = new SpeechSynthesisUtterance(textToRead);
        
        const selectedLang = langSelect ? langSelect.value : 'en-US';
        currentUtterance.lang = selectedLang;
        currentUtterance.rate = 0.9;

        if(outputBox && outputBox.querySelectorAll('span').length > 0) {
            const allSpans = outputBox.querySelectorAll('span');
            currentUtterance.onboundary = function(event) {
                if (event.name === 'word') {
                    document.querySelectorAll('.highlight-word').forEach(el => el.classList.remove('highlight-word'));
                    let charCount = 0;
                    for (let span of allSpans) {
                        const spanLen = span.textContent.length;
                        if (event.charIndex >= charCount && event.charIndex < charCount + spanLen) {
                            span.classList.add('highlight-word');
                            span.scrollIntoView({ behavior: "smooth", block: "center" });
                            break;
                        }
                        charCount += spanLen;
                    }
                }
            };
        }

        currentUtterance.onend = function() { stopTrackRead(); };
        window.speechSynthesis.speak(currentUtterance);
        isSpeakingTrack = true;
        isPaused = false;
        icon.className = 'fas fa-pause';
        if(btnNatural) btnNatural.style.opacity = '0.5';
    }

    function stopTrackRead() {
        window.speechSynthesis.cancel();
        isSpeakingTrack = false;
        isPaused = false;
        if(btnTrack) btnTrack.querySelector('i').className = 'fas fa-highlighter';
        document.querySelectorAll('.highlight-word').forEach(el => el.classList.remove('highlight-word'));
        if(btnNatural) btnNatural.style.opacity = '1';
    }

    // Mod 2: Natural
    async function toggleNaturalRead() {
        if (isSpeakingTrack) stopTrackRead();
        const icon = btnNatural.querySelector('i');

        if (isSpeakingNatural) {
            stopNaturalRead();
            return;
        }

        const textToRead = getSpeechText();
        icon.className = 'fas fa-spinner fa-spin';

        try {
            const selectedLang = langSelect ? langSelect.value : 'en-US';
            const response = await fetch('/.netlify/functions/get-speech', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToRead, lang: selectedLang })
            });

            if (!response.ok) throw new Error("Sunucu hatası");

            const data = await response.json();
            if (data.audioBase64) {
                audioPlayer.src = "data:audio/mp3;base64," + data.audioBase64;
                audioPlayer.play();
                isSpeakingNatural = true;
                icon.className = 'fas fa-stop-circle';
                if(btnTrack) btnTrack.style.opacity = '0.5';
                audioPlayer.onended = function() { stopNaturalRead(); };
            } else {
                alert("Ses hatası.");
                stopNaturalRead();
            }
        } catch (error) {
            console.error(error);
            alert("Bağlantı hatası. (Netlify dev çalışıyor mu?)");
            stopNaturalRead();
        }
    }

    function stopNaturalRead() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        isSpeakingNatural = false;
        if(btnNatural) btnNatural.querySelector('i').className = 'fas fa-podcast';
        if(btnTrack) btnTrack.style.opacity = '1';
    }

    if(btnTrack) btnTrack.addEventListener('click', toggleTrackRead);
    if(btnNatural) btnNatural.addEventListener('click', toggleNaturalRead);


    // =======================================================
    // 6. GENEL FONKSİYONLAR
    // =======================================================
    function setupReadingRuler() {
        if (!rulerHighlight) {
            rulerHighlight = document.createElement('div');
            rulerHighlight.classList.add('reading-ruler-highlight');
            document.body.appendChild(rulerHighlight);
        }
        if (rulerToggle && rulerToggle.checked) {
            rulerHighlight.style.display = 'block';
            updateRulerHeight();
            document.addEventListener('mousemove', moveReadingRuler);
        } else {
            rulerHighlight.style.display = 'none';
            document.removeEventListener('mousemove', moveReadingRuler);
        }
    }
    function updateRulerHeight() {
        if (!rulerHighlight) return;
        if (lineSpacingInput) {
             const baseHeight = 30;
             const spacingMultiplier = parseFloat(lineSpacingInput.value) || 1.5;
             rulerHighlight.style.height = (baseHeight * spacingMultiplier) + 'px';
        } else {
            rulerHighlight.style.height = '45px'; 
        }
    }
    function moveReadingRuler(e) {
        if (!rulerHighlight) return;
        rulerHighlight.style.top = (e.clientY - (rulerHighlight.offsetHeight / 2)) + 'px';
    }
    if (rulerToggle) rulerToggle.addEventListener('change', setupReadingRuler);
    if (lineSpacingInput) lineSpacingInput.addEventListener('input', updateRulerHeight);

    if (globalToggleBtn && globalSidebar) {
        globalToggleBtn.addEventListener('click', function() {
            globalSidebar.classList.toggle('collapsed');
            const icon = globalToggleBtn.querySelector('i');
            icon.className = globalSidebar.classList.contains('collapsed') ? 'fas fa-cog' : 'fas fa-chevron-right';
        });
    }

    tabs.forEach(tab => tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(targetId).classList.add('active');
    }));

    function applyText() {
        if (!textInput || !outputBox) return;
        const rawText = textInput.value;
        outputBox.innerHTML = ''; 
        if (rawText.trim() === '') {
            outputBox.innerHTML = '<p>is available in this box</p>';
            return;
        }
        const paragraphs = rawText.split(/\n+/);
        paragraphs.forEach(paragraphText => {
            if (paragraphText.trim() !== '') {
                const p = document.createElement('p');
                const words = paragraphText.split(' ');
                words.forEach((word, index) => {
                    const span = document.createElement('span');
                    span.textContent = word + ' ';
                    p.appendChild(span);
                });
                outputBox.appendChild(p);
            }
        });
        if (rulerToggle && rulerToggle.checked) setupReadingRuler();
    }
    if(textInput) textInput.addEventListener('input', applyText);

    function applyStyles() {
    const line = lineSpacingInput?.value || "";
    const word = wordSpacingInput?.value + "em" || "";
    const letter = letterSpacingInput?.value + "em" || "";

    // Genel font ayarları
    if (fontStyleSelect) document.body.style.fontFamily = fontStyleSelect.value;
    if (fontSizeSelect) document.body.style.fontSize = fontSizeSelect.value + "px";

    // Satır aralığı
    if (line) {
        document.body.style.lineHeight = line;
        if (textInput) textInput.style.lineHeight = line;
        if (outputBox) outputBox.style.lineHeight = line;
    }

    // Kelime aralığı
    if (wordSpacingInput) {
        document.body.style.wordSpacing = word;
        if (textInput) textInput.style.wordSpacing = word;
        if (outputBox) outputBox.style.wordSpacing = word;
    }

    // Harf aralığı
    if (letterSpacingInput) {
        document.body.style.letterSpacing = letter;
        if (textInput) textInput.style.letterSpacing = letter;
        if (outputBox) outputBox.style.letterSpacing = letter;
    }

    // Eğer cetvel (ruler) açıksa yüksekliği güncelle
    if (typeof updateRulerHeight === "function") updateRulerHeight();
}

    
    function updateSliderValue(slider, display) {
        if(display) display.textContent = slider.value;
    }
    
    const styleInputs = [fontStyleSelect, fontSizeSelect, lineSpacingInput, wordSpacingInput, letterSpacingInput];
    styleInputs.forEach(input => {
        if(input) {
            input.addEventListener('input', () => {
                applyStyles();
                if(input === lineSpacingInput) updateSliderValue(input, lineSpacingValue);
                if(input === wordSpacingInput) updateSliderValue(input, wordSpacingValue);
                if(input === letterSpacingInput) updateSliderValue(input, letterSpacingValue);
            });
        }
    });

    // Başlangıç
    loadSettings();
    if(textInput && textInput.value) applyText();
    applyStyles();
});
// --- HERO SLIDER MANTIĞI (Düzeltilmiş Versiyon) ---
document.addEventListener('DOMContentLoaded', function() {
    
    const slides = document.querySelectorAll('.hero-slide');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    let currentSlide = 0;
    const totalSlides = slides.length;

    // Eğer sayfada slider yoksa kodu çalıştırma (Hata almamak için)
    if (slides.length === 0) return;

    // Slaytı gösteren fonksiyon
    function showSlide(index) {
        // Tüm slaytların 'active' sınıfını kaldır
        slides.forEach(slide => slide.classList.remove('active'));
        
        // index hesaplama (döngüsel olması için)
        // Eğer index eksiye düşerse toplama yaparak sona atar
        currentSlide = (index + totalSlides) % totalSlides;
        
        // Yeni slayta 'active' sınıfı ekle
        slides[currentSlide].classList.add('active');
    }

    // Sonraki Slayt Fonksiyonu
    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    // Önceki Slayt Fonksiyonu
    function prevSlide() {
        showSlide(currentSlide - 1);
    }

    // Butonlara Tıklama Olaylarını Ekle
    if(nextBtn) nextBtn.addEventListener('click', nextSlide);
    if(prevBtn) prevBtn.addEventListener('click', prevSlide);

    // Otomatik Geçiş (7 saniyede bir)
    // Kullanıcı butona basınca karışıklık olmasın diye interval'i bir değişkene atayabiliriz
    let slideInterval = setInterval(nextSlide, 7000);

    // Opsiyonel: Fare slider üzerine gelince otomatik geçişi durdur, çekince başlat
    const sliderContainer = document.querySelector('.hero-slider-container');
    if(sliderContainer) {
        sliderContainer.addEventListener('mouseenter', () => {
            clearInterval(slideInterval);
        });

        sliderContainer.addEventListener('mouseleave', () => {
            slideInterval = setInterval(nextSlide, 7000);
        });
    }
});