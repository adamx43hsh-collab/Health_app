'use client';

import { useState, useEffect } from 'react';
import { getLocalLogs, addLocalLog } from '../lib/storage';
import { calculateFoodScore, calculateProgressScore } from '../lib/scoring';
import { analyzeDiversity } from '../lib/diversity';
import foodDatabase from '../data/food_database.json';

// Simple Icons (SVG strings for inline use)
const HomeIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const LogIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>;
const DiversityIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>;
const CoachIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  
  // States for calculations
  const [progressScore, setProgressScore] = useState({ V: 50, Delta: 0, Sigma: 0, Trend: 'Betöltés...' });
  const [diversityData, setDiversityData] = useState({ mddwScore: 0, plantCount: 0, warnings: [], healthyRotation: true });

  // Coach states
  const [coachMessages, setCoachMessages] = useState([{ role: 'assistant', text: 'Szia! Miben segíthetek ma a táplálkozásoddal kapcsolatban?' }]);
  const [coachInput, setCoachInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Load local logs on mount
    const localLogs = getLocalLogs();
    setLogs(localLogs);
    recalculate(localLogs);
  }, []);

  const recalculate = (currentLogs) => {
    // Progress Score requires daily scores. Let's group by day and calculate WDMS.
    // In a real app, we'd iterate over all days. For now, mock a few past scores if empty, 
    // or calculate based on the logs.
    const mockScores = [50, 52, 55, 60, 58, 62, 65]; // Mocking past 7 days for demo if DB is empty
    const resultV = calculateProgressScore(mockScores);
    setProgressScore(resultV);

    const divResult = analyzeDiversity(currentLogs);
    setDiversityData(divResult);
  };

  const handleAddLog = (e) => {
    e.preventDefault();
    const foodName = e.target.foodName.value;
    const amount = parseInt(e.target.amount.value) || 1;
    
    // Find food in database
    const dbFood = foodDatabase.find(f => f.Name.toLowerCase().includes(foodName.toLowerCase()));
    
    if (dbFood) {
      const newLog = {
        foodName: dbFood.Name,
        category: dbFood.Category,
        isPlant: !dbFood.Category.includes('Húsok') && !dbFood.Category.includes('Tejtermék'),
        amount: amount,
        mass: amount * 100, // Assuming 1 serving = 100g for simplicity
        weightPos: dbFood.Weight_Pos,
        weightNeg: dbFood.Weight_Neg,
        timestamp: new Date().toISOString()
      };
      
      addLocalLog(newLog);
      const newLogs = [...logs, newLog];
      setLogs(newLogs);
      recalculate(newLogs);
      alert('Étel sikeresen rögzítve!');
      e.target.reset();
    } else {
      alert('Sajnos nem található ilyen étel az adatbázisban.');
    }
  };

  const handleCoachSubmit = async (e) => {
    e.preventDefault();
    if (!coachInput.trim()) return;

    const newMsgs = [...coachMessages, { role: 'user', text: coachInput }];
    setCoachMessages(newMsgs);
    setCoachInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: coachInput,
          contextData: { progressScore, diversityData }
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCoachMessages([...newMsgs, { role: 'assistant', text: data.reply }]);
      } else {
        setCoachMessages([...newMsgs, { role: 'assistant', text: 'Hiba történt a kapcsolódáskor. Kérlek ellenőrizd az API kulcsot a Vercelben.' }]);
      }
    } catch (err) {
      setCoachMessages([...newMsgs, { role: 'assistant', text: 'Hálózati hiba történt.' }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="container animate-fade-in">
      
      {/* HEADER */}
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Health Tracker</h1>
        <p>Táplálkozási pontszám és változatosság AI Coach-al</p>
      </header>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="glass" style={{ padding: '2rem' }}>
          <h2>Aktuális Állapotod</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {progressScore.V}
              </span>
              <p>Változási Index</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Trend:</strong> {progressScore.Trend}</p>
              <p><strong>Stabilitás (σ):</strong> {progressScore.Sigma}</p>
              <p><strong>Δ (7-30 nap):</strong> {progressScore.Delta > 0 ? '+' : ''}{progressScore.Delta}</p>
            </div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <p><strong>Mi ez?</strong> A Változási Index (0-100) a Kettős Mozgóátlag (Dual Moving Average) és a szórás alapján mutatja a táplálkozásod fejlődését az elmúlt 30 naphoz képest.</p>
          </div>
        </div>
      )}

      {/* LOGGER TAB */}
      {activeTab === 'logger' && (
        <div className="glass" style={{ padding: '2rem' }}>
          <h2>Mit ettél ma?</h2>
          <form onSubmit={handleAddLog} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label>Étel neve (Keresés az adatbázisban):</label>
              <input type="text" name="foodName" placeholder="pl. Lazac, Spenót, Zabpehely..." required style={{ marginTop: '0.5rem' }} />
            </div>
            <div>
              <label>Mennyiség (Adag / 100g):</label>
              <input type="number" name="amount" min="1" defaultValue="1" required style={{ marginTop: '0.5rem' }} />
            </div>
            <button type="submit" style={{ marginTop: '1rem' }}>Mentés (Pontozás futtatása)</button>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Mai napló ({logs.length} bejegyzés)</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {logs.slice(-5).reverse().map((log, i) => (
              <li key={i} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{log.foodName} ({log.amount} adag)</span>
                <span style={{ color: 'var(--text-secondary)' }}>{log.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DIVERSITY TAB */}
      {activeTab === 'diversity' && (
        <div className="glass" style={{ padding: '2rem' }}>
          <h2>Étrend Változatossága (Food Frequency)</h2>
          
          <div style={{ margin: '2rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-secondary)' }}>
              <h3>MDD-W Élelmiszercsoportok</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{diversityData.mddwScore}</p>
              <p style={{ fontSize: '0.8rem' }}>Különböző kategóriák (cél: minél több)</p>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-primary)' }}>
              <h3>Heti 30-as Szabály (Növények)</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{diversityData.plantCount} / 30</p>
              <p style={{ fontSize: '0.8rem' }}>Különböző növények a héten</p>
            </div>
          </div>

          <h3>Figyelmeztetések (Korlátozandó limitek)</h3>
          {diversityData.warnings.length === 0 ? (
            <p style={{ color: 'var(--accent-primary)' }}>Tökéletes! Nincsenek túllépett limitek a héten.</p>
          ) : (
            <ul style={{ color: 'var(--warning)', paddingLeft: '1.2rem' }}>
              {diversityData.warnings.map((w, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* AI COACH TAB */}
      {activeTab === 'coach' && (
        <div className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '60vh' }}>
          <h2>AI Health Coach</h2>
          
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {coachMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.1)',
                padding: '12px 16px',
                borderRadius: '16px',
                borderBottomRightRadius: m.role === 'user' ? '0' : '16px',
                borderBottomLeftRadius: m.role === 'assistant' ? '0' : '16px',
                maxWidth: '80%'
              }}>
                {m.text}
              </div>
            ))}
            {isTyping && <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)' }}>A Coach gépel...</div>}
          </div>

          <form onSubmit={handleCoachSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={coachInput} 
              onChange={e => setCoachInput(e.target.value)} 
              placeholder="Kérdezz az étrendedről..." 
              style={{ flex: 1 }}
            />
            <button type="submit">Küldés</button>
          </form>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="glass nav-bar">
        <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <HomeIcon /> Összegzés
        </a>
        <a className={`nav-item ${activeTab === 'logger' ? 'active' : ''}`} onClick={() => setActiveTab('logger')}>
          <LogIcon /> Napló
        </a>
        <a className={`nav-item ${activeTab === 'diversity' ? 'active' : ''}`} onClick={() => setActiveTab('diversity')}>
          <DiversityIcon /> Változatosság
        </a>
        <a className={`nav-item ${activeTab === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>
          <CoachIcon /> AI Coach
        </a>
      </nav>

    </div>
  );
}
