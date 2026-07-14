// Állapot (State)
let foodDatabase = [];
let logs = JSON.parse(localStorage.getItem('health_logs')) || [];

// Segéd: Adatbázis betöltése
async function fetchDatabase() {
    try {
        const res = await fetch('/data/food_database.json');
        foodDatabase = await res.json();
    } catch (e) {
        console.error('Nem sikerült betölteni az adatbázist', e);
    }
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
        // Erőltetett reflow az animáció újraindításához
        void targetTab.offsetWidth;
        targetTab.classList.add('animate-fade-in');
        
        if (targetId === 'dashboard') calculateScore();
        if (targetId === 'diversity') calculateDiversity();
    });
});

// Étel naplózása
document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const foodName = document.getElementById('foodName').value;
    const amount = parseFloat(document.getElementById('amount').value);
    
    // Keresés az adatbázisban
    const foodItem = foodDatabase.find(f => f.food.toLowerCase().includes(foodName.toLowerCase()));
    
    const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        foodName: foodItem ? foodItem.food : foodName,
        amount: amount,
        category: foodItem ? foodItem.category : 'Egyéb',
        score: foodItem ? foodItem.score : 0,
        synced: false
    };
    
    logs.push(newLog);
    saveLogs();
    renderLogs();
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
        li.style.padding = '10px';
        li.style.background = 'rgba(255,255,255,0.05)';
        li.style.marginBottom = '8px';
        li.style.borderRadius = '8px';
        li.innerHTML = `<strong>${log.foodName}</strong> - ${log.amount} adag <span style="float:right;color:var(--accent-primary)">${log.score > 0 ? '+'+log.score : log.score} pont</span>`;
        list.appendChild(li);
    });
}

// Szinkronizáció a szerverrel
async function syncWithServer() {
    const unsynced = logs.filter(l => !l.synced);
    if (unsynced.length === 0) return;
    
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: unsynced })
        });
        
        if (response.ok) {
            logs = logs.map(l => ({...l, synced: true}));
            saveLogs();
        }
    } catch (error) {
        console.error('Szinkronizációs hiba', error);
    }
}

// Pontozás (Változási Index - Kettős Mozgóátlag)
function calculateScore() {
    if (logs.length === 0) return;
    
    // 1. Napi összpontszámok számítása
    const dailyScores = {};
    logs.forEach(log => {
        const date = new Date(log.timestamp).toDateString();
        if (!dailyScores[date]) dailyScores[date] = 0;
        dailyScores[date] += (log.score * log.amount);
    });
    
    const scoresArray = Object.values(dailyScores);
    
    // Szigma (Stabilitás) - szórás
    let sigma = 0;
    if (scoresArray.length > 1) {
        const mean = scoresArray.reduce((a, b) => a + b) / scoresArray.length;
        const variance = scoresArray.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scoresArray.length;
        sigma = Math.sqrt(variance).toFixed(1);
    }
    
    const latestScore = scoresArray[scoresArray.length - 1];
    
    // Szigmoid normalizáció 0-100 skálára
    const normalizedScore = Math.round(100 / (1 + Math.exp(-latestScore / 10)));
    
    document.getElementById('dashboard-score').innerText = normalizedScore;
    document.getElementById('dashboard-sigma').innerText = sigma;
    
    if (scoresArray.length >= 2) {
        const prev = scoresArray[scoresArray.length - 2];
        const delta = latestScore - prev;
        document.getElementById('dashboard-delta').innerText = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
        document.getElementById('dashboard-trend').innerText = delta > 0 ? 'Javuló ↗' : 'Romló ↘';
    } else {
        document.getElementById('dashboard-delta').innerText = '-';
        document.getElementById('dashboard-trend').innerText = '-';
    }
}

// Diverzitás számítás
function calculateDiversity() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyLogs = logs.filter(l => new Date(l.timestamp) > oneWeekAgo);
    
    // MDD-W kategóriák (egyedi)
    const uniqueCategories = new Set(weeklyLogs.map(l => l.category));
    document.getElementById('div-mddw').innerText = uniqueCategories.size;
    
    // Növényi ételek (Zöldség, Gyümölcs, Diófélék, Hüvelyesek)
    const plantCategories = ['Zöldség', 'Gyümölcs', 'Diófélék', 'Hüvelyesek', 'Teljes kiőrlésű gabona'];
    const plantLogs = weeklyLogs.filter(l => plantCategories.includes(l.category));
    const uniquePlants = new Set(plantLogs.map(l => l.foodName));
    
    document.getElementById('div-plants').innerText = `${uniquePlants.size} / 30`;
}

// AI Coach Chat
const coachForm = document.getElementById('coach-form');
const coachInput = document.getElementById('coach-input');
const coachChat = document.getElementById('coach-chat');

coachForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = coachInput.value;
    coachInput.value = '';
    
    // Felhasználó üzenete
    appendMessage(msg, 'user');
    
    // Context összeállítása
    const contextData = {
        score: document.getElementById('dashboard-score').innerText,
        trend: document.getElementById('dashboard-trend').innerText,
        plants: document.getElementById('div-plants').innerText,
    };
    
    try {
        const response = await fetch('/api/coach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, contextData })
        });
        
        const data = await response.json();
        if (data.reply) {
            appendMessage(data.reply, 'ai');
        } else {
            appendMessage("Hiba történt az AI elérésekor.", 'ai');
        }
    } catch (e) {
        appendMessage("Hálózati hiba történt.", 'ai');
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
    } else {
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255,255,255,0.1)';
        div.style.borderBottomLeftRadius = '0';
    }
    
    div.innerText = text;
    coachChat.appendChild(div);
    coachChat.scrollTop = coachChat.scrollHeight;
}

// Inicializálás
fetchDatabase().then(() => {
    renderLogs();
    calculateScore();
    calculateDiversity();
    syncWithServer();
});
