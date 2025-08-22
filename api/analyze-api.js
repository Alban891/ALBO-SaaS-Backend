// api/analyze-ai.js
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, from, body, agent } = req.body;

  // Check if API key exists
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API Key fehlt!');
    return res.status(500).json({ 
      error: 'OpenAI API Key not configured',
      mock: true,
      analysis: 'Mock-Analyse: Rechnung erkannt, zur Bearbeitung vorgemerkt.'
    });
  }

  try {
    console.log('🤖 Calling OpenAI API...');
    
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
            content: `Du bist ein ${agent || 'Controller'} AI-Agent im Finance-Bereich. 
            Analysiere die E-Mail und gib eine professionelle Einschätzung.
            Antworte auf Deutsch, kurz und präzise.
            Identifiziere: Kategorie (Rechnung/Mahnung/Anfrage), Priorität, Handlungsempfehlung.`
          },
          {
            role: "user",
            content: `E-Mail von: ${from}\nBetreff: ${subject}\nInhalt: ${body || 'Kein Inhalt'}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI Error:', data);
      throw new Error(data.error?.message || 'OpenAI API Error');
    }

    const aiAnalysis = data.choices[0].message.content;

    // Strukturierte Antwort
    return res.status(200).json({
      success: true,
      ai: true,
      analysis: aiAnalysis,
      usage: {
        tokens: data.usage.total_tokens,
        cost: `$${(data.usage.total_tokens * 0.002 / 1000).toFixed(4)}`
      },
      agent: agent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      mock: true,
      analysis: 'Fallback: E-Mail zur manuellen Bearbeitung markiert.'
    });
  }
}