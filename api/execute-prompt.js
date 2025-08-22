// api/execute-prompt.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, context, useAI } = req.body;

  if (!useAI) {
    // Mock response ohne KI
    return res.status(200).json({
      success: true,
      result: `Mock-Ausführung: ${prompt}\n\nKontext: ${context || 'Kein Kontext'}\n\nDies ist eine Demo-Antwort.`,
      mock: true
    });
  }

  // Mit OpenAI
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'OpenAI API Key not configured' 
    });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Du bist ein Finance-Experte. Beantworte präzise und professionell auf Deutsch."
          },
          {
            role: "user",
            content: `${prompt}\n\nKontext: ${context || 'Allgemeine Anfrage'}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API Error');
    }

    return res.status(200).json({
      success: true,
      result: data.choices[0].message.content,
      ai: true,
      usage: {
        tokens: data.usage.total_tokens,
        model: "gpt-3.5-turbo"
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      mock: true,
      result: 'Fehler bei der KI-Verarbeitung. Bitte versuchen Sie es später erneut.'
    });
  }
}