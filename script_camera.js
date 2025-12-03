
const startOverlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
const select1 = document.getElementById('cam-select-1');
const select2 = document.getElementById('cam-select-2');
const beepAudio = document.getElementById('beep-sound');
const introAudio = document.getElementById('intro-sound');

// State Global untuk Deteksi Kehadiran Tangan
let globalHandDetectionStatus = {
    camera1HandDetected: false,
    camera2HandDetected: false
};

// State Global untuk Deteksi Tangan TERBUKA (Open Palm) - NEW FIX
let globalHandOpenStatus = {
    camera1HandOpen: false,
    camera2HandOpen: false
};

const configs = [
    {
        id: 1,
        videoElement: document.getElementById("input_video1"),
        instructionsElement: document.getElementById("instructions1"),
        statusMessageElement: document.getElementById("status-message1"),
        countdownDisplayElement: document.getElementById("countdown-display1"),
        launchMessageElement: document.getElementById("launch-message1"),
        scanContainer: document.getElementById("container1"),
        progressBar: document.getElementById('progress-bar1'),
        openHandCounter: 0,
        thresholdFrames: 40, // Lebih responsif
        gestureTriggered: false,
        hands: null
    },
    {
        id: 2,
        videoElement: document.getElementById("input_video2"),
        instructionsElement: document.getElementById("instructions2"),
        statusMessageElement: document.getElementById("status-message2"),
        countdownDisplayElement: document.getElementById("countdown-display2"),
        launchMessageElement: document.getElementById("launch-message2"),
        scanContainer: document.getElementById("container2"),
        progressBar: document.getElementById('progress-bar2'),
        openHandCounter: 0,
        thresholdFrames: 40,
        gestureTriggered: false,
        hands: null
    }
];

// --- 1. SETUP UI & PROGRESS BAR ---
configs.forEach(config => {
    const radius = config.progressBar.r.baseVal.value;
    config.circumference = 2 * Math.PI * radius;
    config.progressBar.style.strokeDasharray = config.circumference;
    config.progressBar.style.strokeDashoffset = config.circumference;
});

function showElement(config, el, message = null) {
    config.scanContainer.querySelectorAll('.ui-text').forEach(p => p.classList.remove('visible'));
    if (message) el.innerHTML = message;
    el.classList.add('visible');
}

function setProgress(config, percent, colorOverride = null) {
    const offset = config.circumference - (percent / 100) * config.circumference;
    config.progressBar.style.strokeDashoffset = offset;
    const defaultColor = config.id === 2 ? 'var(--red-glow)' : 'var(--primary-glow)';
    config.progressBar.style.stroke = colorOverride || defaultColor;
}

// --- 2. LOGIKA PILIH KAMERA ---
async function getCameraSelection() {
    try {
        // Trigger permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        select1.innerHTML = '';
        select2.innerHTML = '';

        if (videoDevices.length === 0) {
            alert("Tidak ada kamera terdeteksi!");
            return;
        }

        // Populate Options
        videoDevices.forEach((device, index) => {
            const label = device.label || `Camera ${index + 1}`;
            const opt1 = document.createElement('option');
            opt1.value = device.deviceId;
            opt1.text = label;
            select1.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = device.deviceId;
            opt2.text = label;
            select2.appendChild(opt2);
        });

        // Smart Auto-Selection
        if (videoDevices.length > 1) {
            select1.selectedIndex = 0;
            // Pilih index terakhir untuk kamera kedua agar beda dari kamera pertama
            select2.selectedIndex = videoDevices.length - 1;
            
            // Jika ternyata sama (misal cuma ada 1 device fisik tapi 2 driver), cek ID
            if (select1.value === select2.value && videoDevices.length > 2) {
                select2.selectedIndex = 1;
            }
        }

        startButton.disabled = false;
        startButton.innerHTML = "MULAI SISTEM";
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Mohon izinkan akses kamera.");
    }
}

window.addEventListener('load', getCameraSelection);

// --- 3. LOGIKA DETEKSI GESTURE ---
function createOnResults(config) {
    return function(results) {
        if (config.gestureTriggered) return;

        const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
        
        // Update Global Status Kehadiran
        if (config.id === 1) globalHandDetectionStatus.camera1HandDetected = handDetected;
        if (config.id === 2) globalHandDetectionStatus.camera2HandDetected = handDetected;

        const bothHandsDetected = globalHandDetectionStatus.camera1HandDetected && globalHandDetectionStatus.camera2HandDetected;

        if (handDetected) {
            // Cek Sinkronisasi Kehadiran
            if (!bothHandsDetected) {
                const otherId = config.id === 1 ? 2 : 1;
                showElement(config, config.statusMessageElement, `⚠️ MENUNGGU<br>KAMERA ${otherId}...`);
                config.statusMessageElement.style.color = '#ffa500';
                config.scanContainer.style.borderColor = 'rgba(255, 165, 0, 0.5)';
                // Reset open status jika tangan terdeteksi tapi pasangan belum ada
                if (config.id === 1) globalHandOpenStatus.camera1HandOpen = false;
                if (config.id === 2) globalHandOpenStatus.camera2HandOpen = false;
                return;
            }

            // Deteksi Gesture: Jari Terbuka (Open Palm)
            const lm = results.multiHandLandmarks[0];
            // Logic sederhana: Ujung jari harus diatas pip joint
            const isOpen = lm[8].y < lm[5].y && lm[12].y < lm[9].y && lm[16].y < lm[13].y;

            // Update Global Status Tangan TERBUKA
            if (config.id === 1) globalHandOpenStatus.camera1HandOpen = isOpen;
            if (config.id === 2) globalHandOpenStatus.camera2HandOpen = isOpen;

            // Cek apakah KEDUA tangan terbuka
            const bothHandsOpen = globalHandOpenStatus.camera1HandOpen && globalHandOpenStatus.camera2HandOpen;

            if (isOpen) {
                if (bothHandsOpen) {
                    // --- KEDUA TANGAN TERBUKA: MULAI LOADING ---
                    config.openHandCounter++;
                    const percent = Math.min(100, Math.round((config.openHandCounter / config.thresholdFrames) * 100));
                    
                    showElement(config, config.statusMessageElement, `HOLD... ${percent}%`);
                    config.statusMessageElement.style.color = config.id === 2 ? '#ff4444' : '#00ffff';
                    config.scanContainer.style.borderColor = config.id === 2 ? 'rgba(255, 68, 68, 0.5)' : 'rgba(0, 255, 255, 0.5)';
                    setProgress(config, percent);

                    if (config.openHandCounter >= config.thresholdFrames) {
                        startCountdown(config);
                    }
                } else {
                    // --- SATU TANGAN TERBUKA, TAPI YANG LAIN BELUM ---
                    config.openHandCounter = 0; // Reset counter agar sinkron
                    showElement(config, config.statusMessageElement, "BUKA KEDUA TANGAN");
                    config.statusMessageElement.style.color = '#ffa500'; // Warna peringatan (orange)
                    config.scanContainer.style.borderColor = 'rgba(255, 165, 0, 0.5)';
                    setProgress(config, 0);
                }
            } else {
                // --- TANGAN TERTUTUP ---
                config.openHandCounter = 0;
                showElement(config, config.statusMessageElement, "BUKA TANGAN");
                config.statusMessageElement.style.color = '#fff';
                setProgress(config, 0);
            }
        } else {
            // --- TIDAK ADA TANGAN ---
            if (config.id === 1) globalHandOpenStatus.camera1HandOpen = false;
            if (config.id === 2) globalHandOpenStatus.camera2HandOpen = false;
            
            config.openHandCounter = 0;
            showElement(config, config.instructionsElement);
            config.scanContainer.style.borderColor = config.id === 2 ? 'rgba(255, 68, 68, 0.2)' : 'rgba(0, 255, 255, 0.2)';
            setProgress(config, 0);
        }
    };
}

// --- 4. ANIMASI LAUNCH ---
function startCountdown(config) {
    if (config.gestureTriggered) return;
    config.gestureTriggered = true;
    let val = 3;
    showElement(config, config.countdownDisplayElement, val);
    beepAudio.currentTime = 0; beepAudio.play();

    const interval = setInterval(() => {
        val--;
        if (val > 0) { beepAudio.currentTime = 0; beepAudio.play(); }
        config.countdownDisplayElement.innerHTML = val;
        
        if (val <= 0) {
            clearInterval(interval);
            launchSequence(config);
        }
    }, 1000);
}

function launchSequence(config) {
    // Pause video agar resource hemat
    config.videoElement.pause();
    config.videoElement.style.opacity = '0';
    
    config.scanContainer.classList.add('identifying');
    showElement(config, config.launchMessageElement);
    
    if(introAudio.paused) { introAudio.currentTime = 0; introAudio.play(); }

    // MODIFIKASI: DURASI MENJADI 14 DETIK (14000ms)
    const duration = 6500; 
    const startTime = performance.now();

    function loadAnim(currentTime) {
        const elapsed = currentTime - startTime;
        // Hitung persentase berdasarkan waktu yang berlalu
        let pct = Math.min(100, (elapsed / duration) * 100);
        
        config.launchMessageElement.innerHTML = `<div class="label">IDENTIFYING</div><div class="loading-percent">${Math.floor(pct)}%</div>`;
        setProgress(config, pct, 'var(--primary-glow)');
        
        if (pct < 100) {
            requestAnimationFrame(loadAnim);
        } else {
            finishLaunch(config);
        }
    }
    requestAnimationFrame(loadAnim);
}

function finishLaunch(config) {
    // 1. Tampilkan Efek Hijau
    config.scanContainer.classList.add('access-granted');
    
    // 2. Langsung Tampilkan Pesan (TANPA LOADING LAGI)
    config.launchMessageElement.innerHTML = `<div class="final-message" style="color: var(--secondary-glow); text-shadow:0 0 20px var(--secondary-glow)">ACCESS GRANTED</div>`;
    
    // 3. Ubah Progress Bar Langsung Jadi Hijau Penuh (100%)
    setProgress(config, 100, 'var(--secondary-glow)');

    // 4. Redirect (Jeda sebentar agar user sempat membaca Access Granted)
    setTimeout(() => { 
        window.location.href = "video.mp4"; 
    }, 1000); 
}

// --- 5. INITIALIZE APP ---
async function initializeApp() {
    const id1 = select1.value;
    const id2 = select2.value;

    if (!id1 || !id2) return alert("Pilih kamera dulu!");

    // Hide UI
    startOverlay.style.opacity = '0';
    setTimeout(() => { startOverlay.style.display = 'none'; }, 500);
    configs[1].scanContainer.classList.add('red-theme');
    beepAudio.play().then(() => beepAudio.pause()).catch(()=>{});

    const deviceIds = [id1, id2];

    // Loop Inisialisasi
    for (let i = 0; i < 2; i++) {
        const config = configs[i];
        const selectedDeviceId = deviceIds[i];

        // A. Setup MediaPipe Hands (Lite Model)
        config.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        config.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0, // Lite mode agar enteng
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        config.hands.onResults(createOnResults(config));

        // B. MANUAL STREAM FETCHING (FIX Dual Camera)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: selectedDeviceId }, // Memaksa ID spesifik
                    width: { ideal: 640 }, // Resolusi rendah (VGA) agar USB Controller kuat
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                }
            });

            // Assign stream ke element video
            config.videoElement.srcObject = stream;
            
            // Tunggu video ready state
            config.videoElement.onloadedmetadata = () => {
                config.videoElement.play();
                startDetectionLoop(config); // Mulai kirim gambar ke AI
            };

        } catch (err) {
            console.error(`Gagal Camera ${config.id}:`, err);
            alert(`Gagal membuka kamera ${config.id}. Cek koneksi USB.`);
        }
    }
}

// Loop manual mengirim frame video ke MediaPipe
function startDetectionLoop(config) {
    async function loop() {
        if (!config.videoElement.paused && !config.videoElement.ended) {
            try {
                await config.hands.send({ image: config.videoElement });
            } catch (e) {
                // Ignore frame error
            }
        }
        if (!config.gestureTriggered) {
            requestAnimationFrame(loop);
        }
    }
    loop();
}

startButton.addEventListener('click', initializeApp);
