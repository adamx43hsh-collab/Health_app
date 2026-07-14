import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  try {
    const { message, contextData } = await request.json();
    
    // Fallback model if not provided in env
    const modelName = process.env.AI_MODEL || 'gemini-2.5-flash'; // using standard fallback, user mentioned 3.1 flash_lite
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI API Key is not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Construct prompt with context
    const systemInstruction = `Te egy profi dietetikus és Health Coach vagy. 
Az alábbi adatok a felhasználó táplálkozási pontszámai és étrend változatossági mutatói:
${JSON.stringify(contextData, null, 2)}
Kérlek, válaszolj a felhasználó kérdésére ezen adatok ismeretében, barátságos, motiváló, letisztult stílusban. Ne légy túl bőbeszédű.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return NextResponse.json({ reply: response.text });
  } catch (error) {
    console.error('AI Coach Error:', error);
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}
