import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const { message, contextData } = await request.json();
    
    // Fallback model ha a Vercelben nincs megadva
    const modelName = process.env.AI_MODEL || 'gemini-1.5-flash'; 
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI API Key is not configured' }, { status: 500 });
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

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('AI Coach Error:', error);
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}
