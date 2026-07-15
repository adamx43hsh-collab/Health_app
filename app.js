// Állapot (State)
let foodDatabase = [];
let logs = JSON.parse(localStorage.getItem('health_logs')) || [];
let customFoods = JSON.parse(localStorage.getItem('health_custom_foods')) || [];
let scoreChartInstance = null;

// Segéd: Súly kinyerése (támogatja a régi logs formátumot is)
function getLogWeight(log) {
    if (log.weight !== undefined) return log.weight;
    if (log.score !== undefined) return log.score;
    const dbItem = foodDatabase.find(f => f.name.toLowerCase() === log.foodName.toLowerCase());
    return dbItem ? dbItem.weight : 0;
}

// Segéd: Adatbázis betöltése (Mostantól szinkron, JS-ből)
function loadDatabase() {
    foodDatabase = window.foodDatabaseData || [];
    setupAutocomplete();
}

// Custom Autocomplete rendszer (Android WebView kompatibilis)
function setupAutocomplete() {
    const input = document.getElementById('foodName');
    const dropdown = document.getElementById('food-suggestions');
    if (!input || !dropdown) return;

    function getAllFoods() {
        const names = foodDatabase.map(f => f.name);
        customFoods.forEach(f => {
            if (!names.includes(f.name)) names.push(f.name);
        });
        return names;
    }

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        dropdown.innerHTML = '';

        if (query.length < 1) {
            dropdown.style.display = 'none';
            return;
        }

        const allFoods = getAllFoods();
        const matches = allFoods.filter(name =>
            name.toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        matches.forEach(name => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerText = name;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = name;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(item);
        });

        dropdown.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 250);
    });

    input.addEventListener('focus', () => {
        if (input.value.length > 0) {
            input.dispatchEvent(new Event('input'));
        }
    });
}

// Frissíti az autocomplete-et új ételek hozzáadása után
function refreshAutocomplete() {
    // Az autocomplete input event handler automatikusan az aktuális listából dolgozik,
    // tehát nincs szükség külön frissítésre — a getAllFoods() mindig az élő tömböket olvassa.
}

// Fülek közötti navigáció
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const targetId = e.currentTarget.getAttribute('data-target');
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('animate-fade-in');
        });
        
        const targetTab = document.getElementById(`tab-${targetId}`);
        targetTab.style.display = targetId === 'coach' ? 'flex' : 'block';
        
        // Reflow az animációhoz
        void targetTab.offsetWidth;
        targetTab.classList.add('animate-fade-in');
        
        // Tab-specifikus kalkulációk
        if (targetId === 'dashboard') calculateScore();
        if (targetId === 'diversity') calculateDiversity();
        if (targetId === 'stats') renderStats();
        if (targetId === 'custom-meals') renderCustomMeals();
    });
});

// Étel naplózása
document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const foodNameInput = document.getElementById('foodName').value;
    const amount = parseInt(document.getElementById('amount').value, 10);
    const logDateInput = document.getElementById('log-date').value;
    
    const timestamp = logDateInput ? new Date(logDateInput).toISOString() : new Date().toISOString();
    
    // Keresés az adatbázisban (standard és egyedi ételekben is)
    const foodItem = foodDatabase.find(f => f.name.toLowerCase() === foodNameInput.toLowerCase()) || 
                     customFoods.find(f => f.name.toLowerCase() === foodNameInput.toLowerCase()) ||
                     foodDatabase.find(f => f.name.toLowerCase().includes(foodNameInput.toLowerCase())) ||
                     customFoods.find(f => f.name.toLowerCase().includes(foodNameInput.toLowerCase()));
    
    const newLog = {
        id: Date.now().toString(),
        timestamp: timestamp,
        foodName: foodItem ? foodItem.name : foodNameInput,
        amount: amount,
        category: foodItem ? foodItem.category : 'Egyéb',
        weight: foodItem ? (foodItem.weight !== undefined ? foodItem.weight : 0) : 0,
        isCustom: foodItem ? !!foodItem.isCustom : false,
        customIngredients: foodItem && foodItem.isCustom ? foodItem.ingredients : null,
        synced: false
    };
    
    logs.push(newLog);
    saveLogs();
    renderLogs();
    calculateScore();
    syncWithServer();
    
    document.getElementById('foodName').value = '';
    document.getElementById('amount').value = '1';
    document.getElementById('log-date').valueAsDate = new Date();
});

function saveLogs() {
    localStorage.setItem('health_logs', JSON.stringify(logs));
}

function renderLogs() {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
    
    document.getElementById('log-count').innerText = todayLogs.length;
    
    todayLogs.forEach(log => {
        const li = document.createElement('li');
        li.style.padding = '12px';
        li.style.background = 'rgba(255,255,255,0.03)';
        li.style.marginBottom = '8px';
        li.style.borderRadius = '8px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        const scoreVal = getLogWeight(log);
        const color = scoreVal > 0 ? 'var(--accent-primary)' : (scoreVal < 0 ? 'var(--danger)' : 'var(--text-secondary)');
        const scoreText = scoreVal > 0 ? `+${scoreVal.toFixed(2)} súly` : `${scoreVal.toFixed(2)} súly`;

        li.innerHTML = `
            <div>
                <strong>${log.foodName}</strong> <br>
                <small style="color:var(--text-secondary)">${log.category || 'Egyéb'} | ${log.amount} adag</small>
            </div>
            <span style="color:${color}; font-weight:bold;">${scoreText}</span>
        `;
        list.appendChild(li);
    });
}

// WDMS pont kiszámítása egy időszakra
function getScoreForPeriod(periodLogs) {
    if (periodLogs.length === 0) return 0;
    
    let totalWeightScore = 0;
    let totalPortions = 0;
    
    periodLogs.forEach(log => {
        totalWeightScore += (log.amount * getLogWeight(log));
        totalPortions += log.amount;
    });
    
    if (totalPortions === 0) return 0;
    
    // S = 100 * sum(amount_i * W_i) / T
    const S = 100 * (totalWeightScore / totalPortions);
    
    // P = 100 / (1 + e^(-0.05 * S))
    const P = 100 / (1 + Math.exp(-0.05 * S));
    
    return Math.round(P);
}

// Időszaki pontszámok és Változási Index kiszámítása
function calculateScore() {
    const now = new Date();
    
    // Szűrések különböző időszakokra
    const getLogsForDaysAgo = (days) => {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - days);
        return logs.filter(l => new Date(l.timestamp) >= limitDate);
    };

    const todayStr = now.toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === todayStr);
    
    const daily = getScoreForPeriod(todayLogs);
    const weekly = getScoreForPeriod(getLogsForDaysAgo(7));
    const monthly = getScoreForPeriod(getLogsForDaysAgo(30));
    const yearly = getScoreForPeriod(getLogsForDaysAgo(365));

    document.getElementById('score-daily').innerText = daily;
    document.getElementById('score-weekly').innerText = weekly;
    document.getElementById('score-monthly').innerText = monthly;
    document.getElementById('score-yearly').innerText = yearly;

    // Változási Index (Kettős mozgóátlag + szórás)
    // 30 napi bontásban számoljuk ki a napi pontszámokat
    const dailyScores = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toDateString();
        const dayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === dStr);
        dailyScores.push(getScoreForPeriod(dayLogs));
    }

    // SMA30 (30 nap átlaga)
    const sma30 = dailyScores.reduce((a, b) => a + b, 0) / 30;

    // SMA7 (utolsó 7 nap átlaga)
    const last7Scores = dailyScores.slice(-7);
    const sma7 = last7Scores.reduce((a, b) => a + b, 0) / 7;

    // Delta
    const delta = sma7 - sma30;

    // Szórás (utolsó 7 nap)
    const mean7 = sma7;
    const variance7 = last7Scores.reduce((a, b) => a + Math.pow(b - mean7, 2), 0) / 7;
    const sigma = Math.sqrt(variance7);

    // V = 50 + (2.5 * delta) - (0.5 * sigma)
    let V = 50 + (2.5 * delta) - (0.5 * sigma);
    V = Math.max(0, Math.min(100, Math.round(V)));

    document.getElementById('dashboard-score').innerText = V;
    document.getElementById('dashboard-sigma').innerText = sigma.toFixed(1);
    document.getElementById('dashboard-delta').innerText = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    
    let trend = 'Stabil ➡️';
    if (delta > 2) trend = 'Javuló ↗️';
    else if (delta < -2) trend = 'Romló ↘️';
    document.getElementById('dashboard-trend').innerText = trend;
}

// Diverzitás
function calculateDiversity() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyLogs = logs.filter(l => new Date(l.timestamp) >= oneWeekAgo);

    // 1. MDD-W (Élelmiszercsoportok)
    // Térkép a kategóriákról
    const categoryMapping = {
        'Zöld leveles zöldségek': 'leafy',
        'Egyéb zöldségek': 'veg',
        'Bogyós gyümölcsök': 'fruit',
        'Egyéb gyümölcsök': 'fruit',
        'Hüvelyesek és Szója': 'pulses',
        'Diófélék és magvak': 'nuts',
        'Halak és Húsok': 'meat',
        'Tejtermékek': 'dairy',
        'Gabonafélék': 'grains',
        'Olajok és Zsírok': 'oils'
    };

    const activeGroups = new Set();
    weeklyLogs.forEach(log => {
        if (log.isCustom && log.customIngredients) {
            // Egyedi étel összetevőinek kicsomagolása a változatossághoz
            log.customIngredients.forEach(ing => {
                const dbItem = foodDatabase.find(f => f.name.toLowerCase() === ing.name.toLowerCase());
                if (dbItem) {
                    const cat = dbItem.category || 'Egyéb';
                    const mapped = categoryMapping[cat];
                    if (mapped) activeGroups.add(mapped);
                    if (ing.name.toLowerCase().includes('tojás')) {
                        activeGroups.add('eggs');
                    }
                }
            });
        } else {
            const cat = log.category || 'Egyéb';
            const mapped = categoryMapping[cat];
            if (mapped) activeGroups.add(mapped);
            
            // Külön tojás detektálás (MDD-W csoport)
            if (log.foodName.toLowerCase().includes('tojás')) {
                activeGroups.add('eggs');
            }
        }
    });

    document.getElementById('div-mddw').innerText = activeGroups.size;

    // 2. Heti 30-as szabály (Növényi változatosság)
    const plantCategories = [
        'Zöld leveles zöldségek', 'Egyéb zöldségek', 
        'Bogyós gyümölcsök', 'Egyéb gyümölcsök', 
        'Hüvelyesek és Szója', 'Diófélék és magvak', 
        'Gabonafélék', 'Fűszerek és Egyéb'
    ];
    
    const uniquePlants = new Set();
    weeklyLogs.forEach(log => {
        if (log.isCustom && log.customIngredients) {
            log.customIngredients.forEach(ing => {
                const dbItem = foodDatabase.find(f => f.name.toLowerCase() === ing.name.toLowerCase());
                if (dbItem && plantCategories.includes(dbItem.category || 'Egyéb')) {
                    uniquePlants.add(ing.name.toLowerCase());
                }
            });
        } else {
            const cat = log.category || 'Egyéb';
            if (plantCategories.includes(cat)) {
                uniquePlants.add(log.foodName.toLowerCase());
            }
        }
    });

    document.getElementById('div-plants').innerText = `${uniquePlants.size} / 30`;

    // 3. Korlátozandó élelmiszerek vizsgálata (Szigorú maximumok)
    const warningsDiv = document.getElementById('div-warnings');
    warningsDiv.innerHTML = '';

    const counts = {
        redMeat: 0,
        butter: 0,
        cheese: 0,
        fastFood: 0,
        sweets: 0
    };

    weeklyLogs.forEach(log => {
        const name = log.foodName.toLowerCase();
        const cat = log.category || 'Egyéb';

        if (log.isCustom && log.customIngredients) {
            // Egyedi étel összetevőinek korlátai
            log.customIngredients.forEach(ing => {
                const ingName = ing.name.toLowerCase();
                const dbItem = foodDatabase.find(f => f.name.toLowerCase() === ingName);
                const ingCat = dbItem ? dbItem.category : 'Egyéb';
                const weightedAmount = log.amount * (ing.amount / 100); // 100g-ra jutó arány szorozva adaggal

                if (ingName.includes('marha') || ingName.includes('sertés') || ingName.includes('kolbász') || ingName.includes('szalámi') || ingName.includes('virsli') || ingName.includes('sonka') || ingName.includes('szalonna')) {
                    counts.redMeat += weightedAmount;
                }
                if (ingName.includes('vaj') || ingName.includes('margarin')) {
                    counts.butter += weightedAmount;
                }
                if (ingName.includes('sajt') && ingCat === 'Tejtermékek') {
                    counts.cheese += weightedAmount;
                }
                if (ingCat === 'Bolti Készételek és Alternatívák' || ingName.includes('rántott') || ingName.includes('sült burgonya') || ingName.includes('hamburger') || ingName.includes('pizza')) {
                    counts.fastFood += weightedAmount;
                }
                if (ingCat === 'Édességek és Nassok' || ingName.includes('cukor') || ingName.includes('csokoládé') || ingName.includes('keksz') || ingName.includes('torta') || ingName.includes('fánk') || ingName.includes('croissant')) {
                    counts.sweets += weightedAmount;
                }
            });
        } else {
            // Vörös húsok
            if (name.includes('marha') || name.includes('sertés') || name.includes('kolbász') || name.includes('szalámi') || name.includes('virsli') || name.includes('sonka') || name.includes('szalonna')) {
                counts.redMeat += log.amount;
            }
            // Vaj / Margarin (olajok és zsírok kategórián belül szűrjük a téves mogyoróvaj, vajbab stb. ellen)
            if ((cat === 'Olajok és Zsírok' && (name.includes('vaj') || name.includes('margarin'))) || (name === 'vaj' || name === 'margarin')) {
                counts.butter += log.amount;
            }
            // Sajt
            if (name.includes('sajt') && cat === 'Tejtermékek') {
                counts.cheese += log.amount;
            }
            // Gyorsétel
            if (cat === 'Bolti Készételek és Alternatívák' || name.includes('rántott') || name.includes('sült burgonya') || name.includes('hamburger') || name.includes('pizza')) {
                counts.fastFood += log.amount;
            }
            // Édesség
            if (cat === 'Édességek és Nassok' || name.includes('cukor') || name.includes('csokoládé') || name.includes('keksz') || name.includes('torta') || name.includes('fánk') || name.includes('croissant')) {
                counts.sweets += log.amount;
            }
        }
    });

    const addWarning = (text, current, limit, unit) => {
        const isExceeded = current > limit;
        const color = isExceeded ? 'var(--danger)' : 'var(--accent-primary)';
        const card = document.createElement('div');
        card.style.padding = '10px';
        card.style.background = 'rgba(255,255,255,0.02)';
        card.style.marginBottom = '8px';
        card.style.borderRadius = '8px';
        card.style.borderLeft = `4px solid ${color}`;
        card.innerHTML = `<strong>${text}</strong>: <span style="color:${color}">${current.toFixed(1)}</span> / ${limit} ${unit} ${isExceeded ? '⚠️ (Túllépve!)' : '✅'}`;
        warningsDiv.appendChild(card);
    };

    addWarning('Vörös húsok', counts.redMeat, 4, 'adag/hét');
    addWarning('Vaj és Margarin (napi átlag)', counts.butter / 7, 1, 'adag/nap');
    addWarning('Zsíros sajt', counts.cheese, 1, 'adag/hét');
    addWarning('Bő zsírban sült / Gyorsétel', counts.fastFood, 1, 'alkalom/hét');
    addWarning('Édesség / Hozzáadott cukor', counts.sweets, 5, 'adag/hét');
}

// Statisztika fül kirajzolása
function renderStats() {
    // 1. Chart.js Heti trend kirajzolás
    const ctx = document.getElementById('scoreChart').getContext('2d');
    
    // Utolsó 7 nap napi pontszámai
    const labels = [];
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('hu-HU', { weekday: 'short', day: 'numeric' }));
        
        const dStr = d.toDateString();
        const dayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === dStr);
        chartData.push(getScoreForPeriod(dayLogs));
    }

    if (scoreChartInstance) {
        scoreChartInstance.destroy();
    }

    scoreChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Napi Egészség Pont',
                data: chartData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // 2. Gyakori ételek
    const freqMap = {};
    logs.forEach(log => {
        freqMap[log.foodName] = (freqMap[log.foodName] || 0) + log.amount;
    });

    const sortedFreq = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const freqList = document.getElementById('stats-freq-list');
    freqList.innerHTML = '';
    
    if (sortedFreq.length === 0) {
        freqList.innerHTML = '<p>Nincs még elegendő adat.</p>';
    }

    sortedFreq.forEach(([name, count]) => {
        const li = document.createElement('li');
        li.style.padding = '8px 0';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        li.innerHTML = `<strong>${name}</strong>: ${count} alkalommal`;
        freqList.appendChild(li);
    });

    // 3. Korábbi napok ételei (melyik nap mit ettem)
    const historyList = document.getElementById('stats-history-list');
    historyList.innerHTML = '';
    
    // Csoportosítás napok szerint (ISO dátumkulccsal a helyes string összehasonlításos rendezésért)
    const grouped = {};
    logs.forEach(log => {
        try {
            const dateKey = new Date(log.timestamp).toISOString().split('T')[0]; // e.g. "2026-07-14"
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(`${log.foodName} (${log.amount} adag)`);
        } catch (e) {
            console.error("Dátum konverziós hiba a statisztikában", e);
        }
    });

    const sortedDays = Object.entries(grouped)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7);

    if (sortedDays.length === 0) {
        historyList.innerHTML = '<p>Nincs még bejegyzés.</p>';
    }

    sortedDays.forEach(([dateKey, foods]) => {
        const friendlyDate = new Date(dateKey).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
        const li = document.createElement('li');
        li.style.marginBottom = '12px';
        li.style.padding = '10px';
        li.style.background = 'rgba(255,255,255,0.02)';
        li.style.borderRadius = '6px';
        li.innerHTML = `<span style="font-size:0.85rem; color:var(--accent-secondary); font-weight:bold;">${friendlyDate}</span><br><span style="font-size:0.9rem;">${foods.join(', ')}</span>`;
        historyList.appendChild(li);
    });
}

// Szinkronizáció a szerverrel (Offline/Helyi verzió - elfelejtve a szerver)
async function syncWithServer() {
    // Vercel / Redis elfelejtve, minden helyben marad a telefonon
}

// AI Coach Képfeltöltés Állapot
let selectedImageBase64 = null;
let selectedImageType = null;

const coachFile = document.getElementById('coach-file');
const btnUpload = document.getElementById('btn-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const imagePreviewName = document.getElementById('image-preview-name');
const btnRemoveImage = document.getElementById('btn-remove-image');

if (btnUpload) {
    btnUpload.addEventListener('click', () => {
        coachFile.click();
    });
}

if (coachFile) {
    coachFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        selectedImageType = file.type;
        imagePreviewName.innerText = file.name;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            selectedImageBase64 = event.target.result.split(',')[1];
            imagePreview.src = event.target.result;
            imagePreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });
}

if (btnRemoveImage) {
    btnRemoveImage.addEventListener('click', () => {
        clearSelectedImage();
    });
}

function clearSelectedImage() {
    selectedImageBase64 = null;
    selectedImageType = null;
    if (coachFile) coachFile.value = '';
    if (imagePreview) imagePreview.src = '';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
}

// AI Coach Chat
const coachForm = document.getElementById('coach-form');
const coachInput = document.getElementById('coach-input');
const coachChat = document.getElementById('coach-chat');

coachForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = coachInput.value;
    coachInput.value = '';
    
    appendMessage(msg, 'user');
    
    // Betöltjük a mentett beállításokat a localStorage-ból
    const apiKeyStr = localStorage.getItem('gemini_api_keys') || '';
    const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
    
    if (!apiKeyStr) {
        appendMessage("Hiba: Kérlek add meg a Gemini API kulcsodat a Beállítások fülön (fogaskerék ikon felül)!", 'ai');
        clearSelectedImage();
        return;
    }
    
    const apiKeys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
        appendMessage("Hiba: Nem található érvényes API kulcs. Ellenőrizd a Beállításokat!", 'ai');
        clearSelectedImage();
        return;
    }
    
    // Kontextus adatok lekérése a pontszámokból
    const contextData = {
        napiPontszam: document.getElementById('score-daily').innerText,
        hetiPontszam: document.getElementById('score-weekly').innerText,
        haviPontszam: document.getElementById('score-monthly').innerText,
        valtozasiIndex: document.getElementById('dashboard-score').innerText,
        hetiNovenyiDiverzitas: document.getElementById('div-plants').innerText,
        mddwCsoportSzam: document.getElementById('div-mddw').innerText
    };
    
    const systemInstruction = `Te egy profi dietetikus és Health Coach vagy. 
Az alábbi adatok a felhasználó táplálkozási pontszámai és étrend változatossági mutatói:
${JSON.stringify(contextData, null, 2)}

Ha a felhasználó képet küld ételről/italról, vagy szövegesen kér összehasonlítást, elemezd az ételeket. Döntsd el a MIND diéta pontozási súlyai alapján, hogy melyik az egészségesebb, és magyarázd el miért egyszerűen, pontokba szedve.
A MIND diéta szabályai: leveles zöldségek, zöldségek, bogyós gyümölcsök, magvak, teljes kiőrlésű gabonák, halak, szárnyasok és olívaolaj magas pozitív súlyúak. Vörös húsok, vaj, sajt, édességek, gyorsételek és olajban sültek erősen negatív (büntető) súlyúak.

Kérlek, válaszolj a felhasználó kérdésére ezen adatok ismeretében, barátságos, motiváló, letisztult stílusban. Ne légy túl bőbeszédű. Válaszolj magyarul.`;

    appendMessage("AI Coach gondolkodik...", 'ai-loading');

    let responseText = null;
    let lastError = null;

    // Összeállítjuk a multimodális tartalmat a Gemini API-nak
    const parts = [{ text: msg }];
    if (selectedImageBase64) {
        parts.push({
            inlineData: {
                mimeType: selectedImageType,
                data: selectedImageBase64
            }
        });
        clearSelectedImage(); // töröljük a kijelölést küldés után
    }

    // API Kulcsok rotációja
    for (const key of apiKeys) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: parts
                    }],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (responseText) break;
        } catch (err) {
            console.warn(`Hiba az egyik API kulccsal:`, err);
            lastError = err;
        }
    }

    // Töltődés eltávolítása
    removeLoadingMessage();

    if (responseText) {
        appendMessage(responseText, 'ai');
    } else {
        appendMessage(`Hiba: Nem sikerült választ kapni a Gemini API-tól. Részletek: ${lastError?.message || 'Ismeretlen hiba'}`, 'ai');
    }
});

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('chat-msg');
    
    if (sender === 'user') {
        div.classList.add('user');
    } else if (sender === 'ai-loading') {
        div.classList.add('ai-loading');
        div.id = 'ai-loading-bubble';
    } else {
        div.classList.add('ai');
    }
    
    div.innerText = text;
    coachChat.appendChild(div);
    coachChat.scrollTop = coachChat.scrollHeight;
}

function removeLoadingMessage() {
    const bubble = document.getElementById('ai-loading-bubble');
    if (bubble) {
        bubble.remove();
    }
}

// Beállítások gomb és form eseménykezelők
document.getElementById('btn-settings').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('animate-fade-in');
    });
    
    const settingsTab = document.getElementById('tab-settings');
    settingsTab.style.display = 'block';
    
    void settingsTab.offsetWidth;
    settingsTab.classList.add('animate-fade-in');
    
    document.getElementById('settings-api-key').value = localStorage.getItem('gemini_api_keys') || '';
    const savedModel = localStorage.getItem('gemini_model') || '';
    
    // Automatikus letöltés ha már van mentett kulcs
    if (localStorage.getItem('gemini_api_keys')) {
        fetchModels(savedModel);
    } else {
        document.getElementById('settings-model').innerHTML = '<option value="">Adj meg egy kulcsot a modellek betöltéséhez!</option>';
    }
});

async function fetchModels(selectedModel = '') {
    const apiKeyStr = document.getElementById('settings-api-key').value.trim();
    const select = document.getElementById('settings-model');
    const btn = document.getElementById('btn-fetch-models');
    
    if (!apiKeyStr) {
        alert("Kérlek add meg a Gemini API kulcsodat először!");
        return;
    }
    
    const apiKeys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
    const key = apiKeys[0];
    
    if (btn) {
        btn.innerText = "Betöltés...";
        btn.disabled = true;
    }
    select.innerHTML = '<option value="">Modellek lekérése...</option>';
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const validModels = data.models.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.includes('gemini')
        );
        
        select.innerHTML = '';
        validModels.forEach(m => {
            const val = m.name.replace('models/', '');
            const option = document.createElement('option');
            option.value = val;
            option.innerText = m.displayName ? `${m.displayName} (${val})` : val;
            if (val === selectedModel) option.selected = true;
            select.appendChild(option);
        });
        
        if (validModels.length > 0 && !selectedModel) {
            select.options[0].selected = true;
        }
        
    } catch (err) {
        console.error("Modell lista betöltése sikertelen:", err);
        select.innerHTML = '<option value="">Hiba a betöltésnél. Ellenőrizd a kulcsot!</option>';
    } finally {
        if (btn) {
            btn.innerText = "Modellek betöltése";
            btn.disabled = false;
        }
    }
}

const btnFetchModels = document.getElementById('btn-fetch-models');
if (btnFetchModels) {
    btnFetchModels.addEventListener('click', () => fetchModels());
}

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('settings-api-key').value.trim();
    const model = document.getElementById('settings-model').value;
    
    localStorage.setItem('gemini_api_keys', apiKey);
    if (model) {
        localStorage.setItem('gemini_model', model);
    }
    
    const status = document.getElementById('settings-status');
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
});

// Saját Ételek AI Elemzés és Hozzáadás
const customMealForm = document.getElementById('custom-meal-form');
if (customMealForm) {
    customMealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mealName = document.getElementById('custom-meal-name').value.trim();
        if (!mealName) return;
        
        const apiKeyStr = localStorage.getItem('gemini_api_keys') || '';
        const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
        
        if (!apiKeyStr) {
            alert("Kérlek add meg a Gemini API kulcsodat a Beállítások fülön (fogaskerék ikon jobb felül)!");
            return;
        }
        
        const apiKeys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
        if (apiKeys.length === 0) {
            alert("Nincs érvényes API kulcs megadva!");
            return;
        }
        
        const statusDiv = document.getElementById('custom-meal-status');
        const statusText = document.getElementById('custom-meal-status-text');
        const submitBtn = document.getElementById('btn-custom-meal-submit');
        
        statusDiv.style.display = 'block';
        statusText.innerText = `Az AI épp elemzi a(z) "${mealName}" összetevőit... Ez eltarthat 5-10 másodpercig.`;
        submitBtn.disabled = true;
        
        const prompt = `A felhasználó szeretné hozzáadni a következő egyedi ételt: "${mealName}".
Kérlek, elemezd az ételt, és határozd meg, hogy 100 grammjában a következő 145 alapanyag közül melyek szerepelnek, és milyen arányban (grammban, az összegük legfeljebb 100 legyen).

Elérhető alapanyagok listája:
${JSON.stringify(foodDatabase.map(f => f.name))}

A választ szigorúan és kizárólag érvényes JSON formátumban add meg, mindenféle markdown formázás (pl. \`\`\`json) vagy magyarázó szöveg nélkül! A JSON Struktúra pontosan ez legyen:
{
  "category": "Zöld leveles zöldségek vagy Egyéb zöldségek vagy Bogyós gyümölcsök vagy Egyéb gyümölcsök vagy Hüvelyesek és Szója vagy Diófélék és magvak vagy Halak és Húsok vagy Tejtermékek vagy Gabonafélék vagy Olajok és Zsírok vagy Bolti Készételek és Alternatívák vagy Édességek és Nassok vagy Ízesítők és Szószok vagy Italok vagy Sütés és Kamra vagy Kiegészítők és Extrák",
  "ingredients": [
    { "name": "alapanyag_neve_a_listabol", "amount": gramm_mennyiseg_100g_ban }
  ]
}`;

        let responseText = null;
        let lastError = null;
        
        for (const key of apiKeys) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || `HTTP ${response.status}`);
                }
                
                const data = await response.json();
                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (responseText) break;
            } catch (err) {
                console.warn("Hiba az AI elemzésnél kulccsal:", err);
                lastError = err;
            }
        }
        
        submitBtn.disabled = false;
        
        if (!responseText) {
            statusText.innerText = "Hiba történt az AI elemzés során: " + (lastError?.message || "Ismeretlen hiba");
            statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            statusDiv.style.borderLeft = '4px solid var(--danger)';
            return;
        }
        
        try {
            let cleanText = responseText.trim();
            if (cleanText.startsWith("```")) {
                cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            }
            
            const parsed = JSON.parse(cleanText);
            
            // Súly és pontszám kiszámítása
            let totalWeight = 0;
            let totalAmount = 0;
            
            parsed.ingredients.forEach(ing => {
                const dbItem = foodDatabase.find(f => f.name.toLowerCase() === ing.name.toLowerCase());
                if (dbItem) {
                    totalWeight += (ing.amount * dbItem.weight);
                    totalAmount += ing.amount;
                }
            });
            
            const avgWeight = totalAmount > 0 ? (totalWeight / totalAmount) : 0;
            
            // P = 100 / (1 + e^(-0.05 * 100 * avgWeight))
            const S = 100 * avgWeight;
            const P = Math.round(100 / (1 + Math.exp(-0.05 * S)));
            
            const newCustomFood = {
                name: mealName,
                weight: avgWeight,
                score: P,
                category: parsed.category || 'Bolti Készételek és Alternatívák',
                ingredients: parsed.ingredients,
                isCustom: true
            };
            
            customFoods.push(newCustomFood);
            localStorage.setItem('health_custom_foods', JSON.stringify(customFoods));
            
            document.getElementById('custom-meal-name').value = '';
            statusDiv.style.display = 'none';
            
            renderCustomMeals();
            refreshAutocomplete();
            
        } catch (parseErr) {
            console.error("Hiba az AI válasz beolvasásakor:", parseErr, responseText);
            statusText.innerText = "Hiba: Az AI válasza nem érvényes JSON formátumú. Próbáld újra!";
            statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            statusDiv.style.borderLeft = '4px solid var(--danger)';
        }
    });
}

// Keresés eseménykezelője a saját ételeknél
const customMealSearch = document.getElementById('custom-meal-search');
if (customMealSearch) {
    customMealSearch.addEventListener('input', () => {
        renderCustomMeals();
    });
}

// Saját ételek listázása
function renderCustomMeals() {
    const list = document.getElementById('custom-meal-list');
    if (!list) return;
    list.innerHTML = '';
    
    const searchVal = document.getElementById('custom-meal-search').value.toLowerCase();
    const filtered = customFoods.filter(f => f.name.toLowerCase().includes(searchVal));
    
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 1rem;">Nincs a keresésnek megfelelő saját étel.</p>';
        return;
    }
    
    filtered.forEach(food => {
        const li = document.createElement('li');
        li.style.padding = '1.2rem';
        li.style.background = 'rgba(255,255,255,0.02)';
        li.style.border = '1px solid rgba(255,255,255,0.05)';
        li.style.borderRadius = '12px';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '0.75rem';
        
        const ingNames = food.ingredients.map(i => `${i.name} (${i.amount}g)`).join(', ');
        
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 1.1rem; color: var(--text-primary);">${food.name}</strong><br>
                    <small style="color: var(--text-secondary)">${food.category}</small>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1.5rem; font-weight: bold; color: var(--accent-primary);">${food.score}</span>
                    <p style="font-size: 0.7rem; color: var(--text-secondary); margin: 0; text-transform: uppercase;">súlyozott pont</p>
                </div>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
                <strong>Összetevők (100g-ban):</strong> ${ingNames}
            </div>
            <button onclick="deleteCustomMeal('${food.name.replace(/'/g, "\\'")}')" style="align-self: flex-end; background: none; border: none; color: var(--danger); font-size: 0.85rem; cursor: pointer; padding: 4px; opacity: 0.8; transition: opacity 0.2s;">Törlés</button>
        `;
        list.appendChild(li);
    });
}

window.deleteCustomMeal = function(name) {
    customFoods = customFoods.filter(f => f.name !== name);
    localStorage.setItem('health_custom_foods', JSON.stringify(customFoods));
    renderCustomMeals();
    refreshAutocomplete();
};

// Inicializálás
function initApp() {
    loadDatabase();
    const logDateInput = document.getElementById('log-date');
    if (logDateInput) {
        logDateInput.valueAsDate = new Date();
    }
    renderLogs();
    calculateScore();
    calculateDiversity();
    syncWithServer();
    renderCustomMeals();
}

initApp();

// WebView Cache ürítése és régi Service Worker eltávolítása
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
            console.log('Régi Service Worker eltávolítva.');
        }
    });
}
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names)
            caches.delete(name);
    });
}

// Karbantartás Gombok (Gyorsítótár törlés és Teljes adat nullázás)
const btnClearCache = document.getElementById('btn-clear-cache');
if (btnClearCache) {
    btnClearCache.addEventListener('click', () => {
        if (confirm('Biztosan ki akarod üríteni a böngésző gyorsítótárat? Ez frissíti az alkalmazást a legújabb verzióra.')) {
            if ('caches' in window) {
                caches.keys().then(names => {
                    Promise.all(names.map(name => caches.delete(name))).then(() => {
                        window.location.reload(true);
                    });
                });
            } else {
                window.location.reload(true);
            }
        }
    });
}

const btnDeleteAllData = document.getElementById('btn-delete-all-data');
if (btnDeleteAllData) {
    btnDeleteAllData.addEventListener('click', () => {
        if (confirm('VIGYÁZAT! Ez törli az összes eddigi étkezési naplódat és a saját étel adatbázisodat. A művelet nem vonható vissza. Folytatod?')) {
            localStorage.removeItem('health_logs');
            localStorage.removeItem('health_custom_foods');
            alert('Minden felhasználói adat törölve lett. Az alkalmazás most újraindul.');
            window.location.reload(true);
        }
    });
}
