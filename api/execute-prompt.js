// api/execute-prompt.js
const { Configuration, OpenAIApi } = require('openai');
const ALBO_PROMPTS = require('./prompts-data.js');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-...' // Dein API Key
});
const openai = new OpenAIApi(configuration);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { promptId, answers, useAI = true } = req.body;
    
    // Finde den Prompt
    const prompt = ALBO_PROMPTS.find(p => p.id === promptId);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    // Fülle Template mit Antworten
    let filledPrompt = prompt.promptTemplate;
    Object.keys(answers || {}).forEach(key => {
      const value = answers[key];
      filledPrompt = filledPrompt.replace(
        new RegExp(`{{${key}}}`, 'g'),
        value || 'Nicht angegeben'
      );
    });
    
    // Wenn AI deaktiviert, gib nur den gefüllten Prompt zurück
    if (!useAI) {
      return res.status(200).json({
        success: true,
        analysis: filledPrompt,
        isDemo: true
      });
    }
    
    // OpenAI API Call
    console.log('Calling OpenAI with Business Case prompt...');
    
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Du bist ein erfahrener Financial Controller und erstellst professionelle Business Cases. Antworte immer auf Deutsch und strukturiert."
        },
        {
          role: "user",
          content: filledPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2500
    });
    
    const analysis = completion.data.choices[0].message.content;
    
    // Formatiere für bessere Darstellung
    const formattedAnalysis = formatBusinessCaseOutput(analysis);
    
    return res.status(200).json({
      success: true,
      analysis: formattedAnalysis,
      isDemo: false,
      metadata: {
        model: "gpt-4",
        promptId: promptId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in execute-prompt:', error);
    
    // Fallback auf Demo-Modus bei Fehler
    return res.status(200).json({
      success: true,
      analysis: generateDemoBusinessCase(req.body.answers),
      isDemo: true,
      error: error.message
    });
  }
};

// Formatierung des Outputs
function formatBusinessCaseOutput(text) {
  // Füge bessere Formatierung hinzu
  return text
    .replace(/##/g, '\n##')
    .replace(/\*\*/g, '')
    .replace(/\n\n\n/g, '\n\n')
    .trim();
}

// Demo Business Case Generator
function generateDemoBusinessCase(answers) {
  const investment = answers?.investment_volume || '1.000.000';
  const returns = answers?.expected_returns || '200.000';
  const period = answers?.calculation_period || '5 Jahre';
  
  return `
═══════════════════════════════════════════════════════
📊 BUSINESS CASE ANALYSE
═══════════════════════════════════════════════════════

🎯 INVESTITIONSÜBERSICHT
────────────────────────────────────────────────────────
Investitionsgegenstand: ${answers?.investment_object || 'Neue Produktionsanlage'}
Investitionsvolumen:    ${investment} €
Laufzeit:              ${period}
Kalkulationszins:      ${answers?.discount_rate || '6'}%

📈 WIRTSCHAFTLICHKEITSKENNZAHLEN
────────────────────────────────────────────────────────
▸ Kapitalwert (NPV):        +267.579 €  ✅
▸ Interner Zinsfuß (IRR):   11,8%       ✅
▸ Amortisationsdauer:       4,7 Jahre   ✅
▸ ROI:                      31,5%       ✅

📊 CASHFLOW-PROJEKTION
────────────────────────────────────────────────────────
Jahr 1:  ${returns} € (Barwert: 188.679 €)
Jahr 2:  ${returns} € (Barwert: 178.000 €)
Jahr 3:  ${returns} € (Barwert: 167.924 €)
Jahr 4:  ${returns} € (Barwert: 158.419 €)
Jahr 5:  ${returns} € (Barwert: 149.452 €)

✅ EMPFEHLUNG
────────────────────────────────────────────────────────
Die Investition wird EMPFOHLEN aufgrund:
- Positiver Kapitalwert
- IRR über Hurdle Rate
- Akzeptable Amortisationsdauer
- Strategischer Fit

⚠️ RISIKEN
────────────────────────────────────────────────────────
- Technologischer Wandel
- Marktvolatilität
- Wartungskosten-Steigerung

💡 NÄCHSTE SCHRITTE
────────────────────────────────────────────────────────
1. Freigabe durch Investment Committee
2. Detailplanung Implementierung
3. Lieferantenauswahl starten

[DEMO-MODUS: Mit echtem OpenAI API Key würde hier eine vollständige Analyse stehen]
`;
}
