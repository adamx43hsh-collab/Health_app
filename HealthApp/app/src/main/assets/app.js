// Állapot (State)
let foodDatabase = [];
let logs = JSON.parse(localStorage.getItem('health_logs')) || [];
let scoreChartInstance = null;

// Segéd: Súly kinyerése (támogatja a régi logs formátumot is)
function getLogWeight(log) {
    if (log.weight !== undefined) return log.weight;
    if (log.score !== undefined) return log.score;
    const dbItem = foodDatabase.find(f => f.name.toLowerCase() === log.foodName.toLowerCase());
    return dbItem ? dbItem.weight : 0;
}

// Segéd: Adatbázis betöltése
async function fetchDatabase() {
    try {
        const res = await fetch('data/food_database.json');
        foodDatabase = await res.json();
        populateDatalist();
    } catch (e) {
        console.error('Nem sikerült betölteni az adatbázist', e);
    }
}

// Autocomplete feltöltése
function populateDatalist() {
    const datalist = document.getElementById('food-list');
    datalist.innerHTML = '';
    foodDatabase.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        datalist.appendChild(option);
    });
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
    });
});

// Étel naplózása
document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const foodNameInput = document.getElementById('foodName').value;
    const amount = parseFloat(document.getElementById('amount').value);
    
    // Keresés az adatbázisban
    const foodItem = foodDatabase.find(f => f.name.toLowerCase() === foodNameInput.toLowerCase()) || 
                     foodDatabase.find(f => f.name.toLowerCase().includes(foodNameInput.toLowerCase()));
    
    const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        foodName: foodItem ? foodItem.name : foodNameInput,
        amount: amount,
        category: foodItem ? foodItem.category : 'Egyéb',
        weight: foodItem ? foodItem.weight : 0,
        synced: false
    };
    
    logs.push(newLog);
    saveLogs();
    renderLogs();
    calculateScore();
    syncWithServer();
    
    document.getElementById('foodName').value = '';
    document.getElementById('amount').value = '1';
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
        const cat = log.category || 'Egyéb';
        const mapped = categoryMapping[cat];
        if (mapped) activeGroups.add(mapped);
        
        // Külön tojás detektálás (MDD-W csoport)
        if (log.foodName.toLowerCase().includes('tojás')) {
            activeGroups.add('eggs');
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
    const plantLogs = weeklyLogs.filter(l => plantCategories.includes(l.category || 'Egyéb'));
    const uniquePlants = new Set(plantLogs.map(l => l.foodName.toLowerCase()));

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
        return;
    }
    
    const apiKeys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
        appendMessage("Hiba: Nem található érvényes API kulcs. Ellenőrizd a Beállításokat!", 'ai');
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
Kérlek, válaszolj a felhasználó kérdésére ezen adatok ismeretében, barátságos, motiváló, letisztult stílusban. Ne légy túl bőbeszédű. Válaszolj magyarul.`;

    appendMessage("AI Coach gondolkodik...", 'ai-loading');

    let responseText = null;
    let lastError = null;

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
                        parts: [{ text: msg }]
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
    div.style.padding = '12px 16px';
    div.style.borderRadius = '16px';
    div.style.maxWidth = '80%';
    div.style.marginBottom = '8px';
    
    if (sender === 'user') {
        div.style.alignSelf = 'flex-end';
        div.style.background = 'var(--accent-primary)';
        div.style.color = 'white';
        div.style.borderBottomRightRadius = '0';
    } else if (sender === 'ai-loading') {
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.color = 'var(--text-secondary)';
        div.style.borderBottomLeftRadius = '0';
        div.id = 'ai-loading-bubble';
    } else {
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255,255,255,0.1)';
        div.style.borderBottomLeftRadius = '0';
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
    document.getElementById('settings-model').value = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
});

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('settings-api-key').value.trim();
    const model = document.getElementById('settings-model').value;
    
    localStorage.setItem('gemini_api_keys', apiKey);
    localStorage.setItem('gemini_model', model);
    
    const status = document.getElementById('settings-status');
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
});

// Inicializálás
fetchDatabase().then(() => {
    renderLogs();
    calculateScore();
    calculateDiversity();
    syncWithServer();
});

// Service Worker regisztráció PWA-hoz
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker regisztrálva', reg))
            .catch(err => console.error('Service Worker hiba', err));
    });
}
