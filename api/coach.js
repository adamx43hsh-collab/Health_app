const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, contextData } = req.body;
    
    // Fallback model ha a Vercelben nincs megadva
    const modelName = process.env.AI_MODEL || 'gemini-1.5-flash'; 
    const apiKeysString = process.env.GEMINI_API_KEY;

    if (!apiKeysString) {
      return res.status(500).json({ error: 'AI API Key (GEMINI_API_KEY) is not configured in Vercel' });
    }

    // Támogatja a vesszővel elválasztott több kulcsot (rotáció és redundancia)
    const apiKeys = apiKeysString.split(',').map(k => k.trim()).filter(Boolean);
    
    if (apiKeys.length === 0) {
      return res.status(500).json({ error: 'No valid AI API Keys found in GEMINI_API_KEY' });
    }

    let responseText = null;
    let lastError = null;

    // Megpróbáljuk a kulcsokat sorban, amíg valamelyik nem működik
    for (const key of apiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const systemInstruction = `Te egy profi dietetikus és Health Coach vagy. 
Az alábbi adatok a felhasználó táplálkozási pontszámai és étrend változatossági mutatói:
${JSON.stringify(contextData, null, 2)}
Kérlek, válaszolj a felhasználó kérdésére ezen adatok ismeretében, barátságos, motiváló, letisztult stílusban. Ne légy túl bőbeszédű.`;

        const model = genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemInstruction 
        });

        const result = await model.generateContent(message);
        responseText = result.response.text();
        
        if (responseText) {
          break; // Sikerült, kilépünk a ciklusból
        }
      } catch (err) {
        console.warn(`Nem sikerült a kérés az egyik API kulccsal: ${err.message || err}`);
        lastError = err;
      }
    }

    if (responseText) {
      return res.status(200).json({ reply: responseText });
    } else {
      throw lastError || new Error("All API keys failed to generate content");
    }

  } catch (error) {
    console.error('AI Coach Error:', error);
    return res.status(500).json({ error: 'Failed to generate AI response with any key. Error: ' + (error.message || error) });
  }
}
