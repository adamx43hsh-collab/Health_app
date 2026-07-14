import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, contextData } = req.body;
    
    // Fallback model ha a Vercelben nincs megadva
    const modelName = process.env.AI_MODEL || 'gemini-1.5-flash'; 
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'AI API Key is not configured in Vercel' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Te egy profi dietetikus és Health Coach vagy. 
Az alábbi adatok a felhasználó táplálkozási pontszámai és étrend változatossági mutatói:
${JSON.stringify(contextData, null, 2)}
Kérlek, válaszolj a felhasználó kérdésére ezen adatok ismeretében, barátságos, motiváló, letisztult stílusban. Ne légy túl bőbeszédű.`;

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction 
    });

    const result = await model.generateContent(message);
    const text = result.response.text();

    return res.status(200).json({ reply: text });
  } catch (error) {
    console.error('AI Coach Error:', error);
    return res.status(500).json({ error: 'Failed to generate AI response' });
  }
}
