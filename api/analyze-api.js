// api/analyze-api.js
const OpenAI = require('openai');

// OpenAI Client initialisieren
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { emailContent, agent } = req.body;

        if (!emailContent) {
            return res.status(400).json({ error: 'Email content is required' });
        }

        // System Prompt für Finance-Analyse
        const systemPrompt = `Du bist ein spezialisierter Finance AI Agent mit Fokus auf ${agent || 'Controller'}-Aufgaben.
        
Analysiere die folgende E-Mail und gib eine strukturierte Antwort mit:
1. Zusammenfassung (2-3 Sätze)
2. Identifizierte Aufgaben/Action Items
3. Empfohlene nächste Schritte
4. Relevante Finance-Kategorien (z.B. Buchhaltung, Reporting, Compliance)
5. Priorität (Hoch/Mittel/Niedrig)
6. Geschätzter Zeitaufwand

Antworte auf Deutsch und sei präzise und professionell.`;

        // OpenAI API Aufruf
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Günstigeres Modell für schnelle Analysen
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analysiere diese E-Mail:\n\nBetreff: ${emailContent.subject}\nVon: ${emailContent.from}\n\nInhalt:\n${emailContent.body}` }
            ],
            temperature: 0.3, // Niedrige Temperature für konsistente Antworten
            max_tokens: 800
        });

        const aiAnalysis = completion.choices[0].message.content;

        // Strukturierte Antwort erstellen
        const response = {
            success: true,
            analysis: {
                summary: extractSection(aiAnalysis, "Zusammenfassung"),
                actionItems: extractActionItems(aiAnalysis),
                nextSteps: extractSection(aiAnalysis, "nächste Schritte"),
                categories: extractCategories(aiAnalysis),
                priority: extractPriority(aiAnalysis),
                estimatedTime: extractTime(aiAnalysis),
                fullAnalysis: aiAnalysis
            },
            metadata: {
                agent: agent || 'Controller',
                analyzedAt: new Date().toISOString(),
                model: 'gpt-4o-mini',
                emailLength: emailContent.body ? emailContent.body.length : 0
            },
            recommendations: {
                suggestedPrompts: getSuggestedPrompts(aiAnalysis, agent),
                automationPossible: checkAutomationPotential(aiAnalysis),
                sapRelevant: checkSAPRelevance(aiAnalysis)
            }
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('OpenAI API Error:', error);
        
        // Fallback auf Mock-Daten bei Fehler
        if (error.message && error.message.includes('API key')) {
            return res.status(500).json({
                error: 'OpenAI API Key nicht konfiguriert',
                mockData: true,
                analysis: getMockAnalysis(req.body.agent)
            });
        }

        return res.status(500).json({ 
            error: 'Analyse fehlgeschlagen', 
            details: error.message 
        });
    }
};

// Hilfsfunktionen zum Extrahieren von Informationen
function extractSection(text, keyword) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
            // Nächste 2-3 Zeilen nach dem Keyword zurückgeben
            return lines.slice(i, i + 3).join(' ').replace(/[0-9]\./g, '').trim();
        }
    }
    return text.substring(0, 200);
}

function extractActionItems(text) {
    const items = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (line.match(/^[-•*]|^[0-9]\./)) {
            items.push(line.replace(/^[-•*]|^[0-9]\./, '').trim());
        }
    }
    
    return items.slice(0, 5); // Maximal 5 Action Items
}

function extractCategories(text) {
    const categories = [];
    const keywords = {
        'Buchhaltung': ['buchung', 'rechnung', 'beleg', 'konto'],
        'Reporting': ['bericht', 'report', 'auswertung', 'analyse'],
        'Compliance': ['compliance', 'richtlinie', 'vorschrift', 'audit'],
        'Treasury': ['liquidität', 'zahlung', 'cash', 'treasury'],
        'Steuern': ['steuer', 'tax', 'finanzamt', 'umsatzsteuer'],
        'Controlling': ['budget', 'forecast', 'planung', 'controlling']
    };

    const lowerText = text.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
        if (words.some(word => lowerText.includes(word))) {
            categories.push(category);
        }
    }
    
    return categories.length > 0 ? categories : ['Allgemein'];
}

function extractPriority(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('dringend') || lowerText.includes('hoch') || lowerText.includes('asap')) {
        return 'Hoch';
    }
    if (lowerText.includes('niedrig') || lowerText.includes('kann warten')) {
        return 'Niedrig';
    }
    return 'Mittel';
}

function extractTime(text) {
    const timeMatch = text.match(/(\d+)\s*(minuten|stunden|tage)/i);
    if (timeMatch) {
        return `${timeMatch[1]} ${timeMatch[2]}`;
    }
    return '30 Minuten';
}

function getSuggestedPrompts(analysis, agent) {
    // Basierend auf der Analyse passende Prompts vorschlagen
    const prompts = [];
    const lowerAnalysis = analysis.toLowerCase();
    
    if (lowerAnalysis.includes('rechnung')) {
        prompts.push('Rechnungsprüfung durchführen');
        prompts.push('Zahlungsbedingungen analysieren');
    }
    
    if (lowerAnalysis.includes('report') || lowerAnalysis.includes('bericht')) {
        prompts.push('Monatsbericht erstellen');
        prompts.push('KPIs zusammenfassen');
    }
    
    if (lowerAnalysis.includes('budget')) {
        prompts.push('Budgetabweichung analysieren');
        prompts.push('Forecast aktualisieren');
    }
    
    return prompts.slice(0, 3);
}

function checkAutomationPotential(analysis) {
    const automationKeywords = ['wiederkehrend', 'standard', 'routine', 'regelmäßig', 'automatisch'];
    const lowerAnalysis = analysis.toLowerCase();
    
    return automationKeywords.some(keyword => lowerAnalysis.includes(keyword));
}

function checkSAPRelevance(analysis) {
    const sapKeywords = ['buchung', 'sap', 'kreditor', 'debitor', 'kostenstelle', 'bestellung'];
    const lowerAnalysis = analysis.toLowerCase();
    
    return sapKeywords.some(keyword => lowerAnalysis.includes(keyword));
}

function getMockAnalysis(agent) {
    return {
        summary: "Mock-Daten: OpenAI API Key fehlt. Bitte in Vercel Environment Variables eintragen.",
        actionItems: ["OpenAI API Key konfigurieren", "Vercel Deployment neu starten"],
        nextSteps: "API Key in Vercel Settings hinzufügen",
        categories: ["Setup", "Konfiguration"],
        priority: "Hoch",
        estimatedTime: "5 Minuten",
        fullAnalysis: "Dies sind Mock-Daten. Für echte KI-Analysen muss der OpenAI API Key in Vercel konfiguriert werden."
    };
}
