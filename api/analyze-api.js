// api/analyze-api.js

module.exports = async (req, res) => {
    console.log('=== ANALYZE-API START ===');
    console.log('Method:', req.method);
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('API Key first 10 chars:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT SET');
    
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
        console.log('Email Subject:', emailContent?.subject);
        console.log('Agent:', agent);

        if (!emailContent) {
            return res.status(400).json({ error: 'Email content is required' });
        }

        // Check if OpenAI API key exists
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not set!');
            return res.status(200).json({
                success: true,
                source: 'mock',
                analysis: {
                    summary: "⚠️ OpenAI API Key nicht konfiguriert. Dies sind Mock-Daten. Bitte OPENAI_API_KEY in Vercel Environment Variables hinzufügen.",
                    actionItems: [
                        "OpenAI API Key in Vercel Settings → Environment Variables eintragen",
                        "Deployment neu starten nach dem Hinzufügen",
                        "Diese Seite in 2 Minuten neu laden"
                    ],
                    nextSteps: "1. Vercel Dashboard öffnen\n2. Settings → Environment Variables\n3. OPENAI_API_KEY hinzufügen",
                    categories: ["Setup Required"],
                    priority: "Hoch",
                    estimatedTime: "5 Minuten",
                    fullAnalysis: "Der OpenAI API Key wurde noch nicht in Vercel konfiguriert. Ohne diesen Key können keine echten KI-Analysen durchgeführt werden."
                },
                metadata: {
                    agent: agent || 'Controller',
                    analyzedAt: new Date().toISOString(),
                    model: 'MOCK - No API Key',
                    error: 'OPENAI_API_KEY not configured'
                }
            });
        }

        // Try to import OpenAI only if key exists
        const OpenAI = require('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('Creating OpenAI completion...');

        // Detaillierter System Prompt für Rechnungsanalyse
        const systemPrompt = `Du bist ein spezialisierter ${agent || 'Debitorenbuchhalter'} AI-Agent für das deutsche Finanzwesen.

AUFGABE: Analysiere die folgende E-Mail sehr genau und extrahiere ALLE relevanten Informationen.

Gib eine strukturierte Antwort in diesem Format:

ZUSAMMENFASSUNG: (2-3 präzise Sätze über den Kern der E-Mail)

ERKANNTE DETAILS:
- Rechnungsnummer: [Nummer falls vorhanden]
- Betrag: [Betrag falls erwähnt]
- Fälligkeitsstatus: [überfällig/offen/bezahlt]
- Kunde/Lieferant: [Name falls erkennbar]
- Datum: [relevante Daten]

ACTION ITEMS:
1. [Konkrete Aufgabe 1]
2. [Konkrete Aufgabe 2]
3. [Weitere falls nötig]

NÄCHSTE SCHRITTE:
[Klare Handlungsempfehlung in 1-2 Sätzen]

KATEGORIEN: [Zutreffende aus: Mahnwesen, Zahlungseingang, Rechnungsprüfung, Buchhaltung, Reporting, Compliance]

PRIORITÄT: [Hoch/Mittel/Niedrig basierend auf Dringlichkeit]

GESCHÄTZTER ZEITAUFWAND: [Realistische Schätzung]

SAP-RELEVANZ: [Ja/Nein - Muss dies in SAP gebucht werden?]

Sei sehr präzise und professionell. Antworte auf Deutsch.`;

        const userMessage = `E-Mail zur Analyse:
Betreff: ${emailContent.subject}
Von: ${emailContent.from}
An: ${emailContent.to || 'Nicht angegeben'}

Inhalt:
${emailContent.body}`;

        // OpenAI API Aufruf mit mehr Details
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.2, // Sehr niedrig für konsistente, faktische Antworten
            max_tokens: 1000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

        const aiAnalysis = completion.choices[0].message.content;
        console.log('OpenAI Response received, length:', aiAnalysis.length);

        // Parse die strukturierte Antwort
        const response = {
            success: true,
            source: 'openai',
            analysis: parseStructuredAnalysis(aiAnalysis),
            metadata: {
                agent: agent || 'Debitorenbuchhalter',
                analyzedAt: new Date().toISOString(),
                model: 'gpt-4o-mini',
                emailLength: emailContent.body ? emailContent.body.length : 0,
                tokensUsed: completion.usage?.total_tokens || 0
            },
            recommendations: {
                suggestedPrompts: extractSuggestedPrompts(aiAnalysis, emailContent),
                automationPossible: aiAnalysis.toLowerCase().includes('automatisch') || aiAnalysis.toLowerCase().includes('standard'),
                sapRelevant: aiAnalysis.toLowerCase().includes('sap') || aiAnalysis.toLowerCase().includes('buchung')
            },
            debug: {
                apiKeyPresent: true,
                modelUsed: 'gpt-4o-mini',
                timestamp: new Date().toISOString()
            }
        };

        console.log('=== ANALYZE-API SUCCESS ===');
        return res.status(200).json(response);

    } catch (error) {
        console.error('=== ANALYZE-API ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Detaillierte Fehlerbehandlung
        let errorResponse = {
            success: false,
            source: 'error',
            error: error.message,
            analysis: {
                summary: `Fehler bei der Analyse: ${error.message}`,
                actionItems: ["Fehler überprüfen", "Support kontaktieren falls Problem besteht"],
                nextSteps: "Bitte versuchen Sie es in wenigen Sekunden erneut.",
                categories: ["Fehler"],
                priority: "Hoch",
                estimatedTime: "Unbekannt",
                fullAnalysis: `Ein Fehler ist aufgetreten: ${error.message}`
            }
        };

        // Spezifische Fehlerbehandlung
        if (error.message?.includes('401')) {
            errorResponse.analysis.summary = "API Key ungültig oder falsch formatiert";
            errorResponse.analysis.actionItems = [
                "OpenAI API Key in Vercel prüfen",
                "Sicherstellen dass der Key mit 'sk-' beginnt",
                "Key auf Gültigkeit prüfen auf platform.openai.com"
            ];
        } else if (error.message?.includes('429')) {
            errorResponse.analysis.summary = "Rate Limit erreicht - zu viele Anfragen";
            errorResponse.analysis.actionItems = ["Einen Moment warten", "Erneut versuchen"];
        } else if (error.message?.includes('openai')) {
            errorResponse.analysis.summary = "OpenAI Modul konnte nicht geladen werden";
            errorResponse.analysis.actionItems = ["Package.json prüfen", "npm install openai ausführen"];
        }

        return res.status(200).json(errorResponse);
    }
};

// Hilfsfunktion zum Parsen der strukturierten Antwort
function parseStructuredAnalysis(text) {
    const analysis = {
        summary: "",
        actionItems: [],
        nextSteps: "",
        categories: [],
        priority: "Mittel",
        estimatedTime: "30 Minuten",
        fullAnalysis: text,
        extractedDetails: {}
    };

    // Zusammenfassung extrahieren
    const summaryMatch = text.match(/ZUSAMMENFASSUNG:?\s*(.+?)(?=ERKANNTE|ACTION|$)/si);
    if (summaryMatch) {
        analysis.summary = summaryMatch[1].trim();
    }

    // Details extrahieren
    const detailsMatch = text.match(/ERKANNTE DETAILS:?\s*(.+?)(?=ACTION|NÄCHSTE|$)/si);
    if (detailsMatch) {
        const details = detailsMatch[1];
        
        // Rechnungsnummer
        const invoiceMatch = details.match(/Rechnungsnummer:?\s*(\S+)/i);
        if (invoiceMatch) analysis.extractedDetails.invoiceNumber = invoiceMatch[1];
        
        // Betrag
        const amountMatch = details.match(/Betrag:?\s*([\d,\.]+\s*(?:EUR|€)?)/i);
        if (amountMatch) analysis.extractedDetails.amount = amountMatch[1];
        
        // Status
        const statusMatch = details.match(/status:?\s*(\S+)/i);
        if (statusMatch) analysis.extractedDetails.status = statusMatch[1];
    }

    // Action Items extrahieren
    const actionMatch = text.match(/ACTION ITEMS:?\s*(.+?)(?=NÄCHSTE|KATEGORIEN|$)/si);
    if (actionMatch) {
        const items = actionMatch[1].match(/\d\.\s*(.+?)(?=\d\.|$)/gi);
        if (items) {
            analysis.actionItems = items.map(item => item.replace(/^\d\.\s*/, '').trim());
        }
    }

    // Nächste Schritte
    const nextMatch = text.match(/NÄCHSTE SCHRITTE:?\s*(.+?)(?=KATEGORIEN|PRIORITÄT|$)/si);
    if (nextMatch) {
        analysis.nextSteps = nextMatch[1].trim();
    }

    // Kategorien
    const catMatch = text.match(/KATEGORIEN:?\s*(.+?)(?=PRIORITÄT|GESCHÄTZ|$)/si);
    if (catMatch) {
        analysis.categories = catMatch[1].split(/[,;]/).map(c => c.trim()).filter(c => c);
    }

    // Priorität
    const prioMatch = text.match(/PRIORITÄT:?\s*(Hoch|Mittel|Niedrig)/i);
    if (prioMatch) {
        analysis.priority = prioMatch[1];
    }

    // Zeitaufwand
    const timeMatch = text.match(/ZEITAUFWAND:?\s*(.+?)(?=SAP|$)/si);
    if (timeMatch) {
        analysis.estimatedTime = timeMatch[1].trim();
    }

    return analysis;
}

// Verbesserte Prompt-Vorschläge basierend auf E-Mail-Inhalt
function extractSuggestedPrompts(analysis, emailContent) {
    const prompts = [];
    const content = (analysis + ' ' + emailContent.body).toLowerCase();
    
    if (content.includes('rechnung')) {
        if (content.includes('mahnung') || content.includes('überfällig')) {
            prompts.push('Mahnprozess für überfällige Rechnung einleiten');
            prompts.push('Zahlungserinnerung mit Verzugszinsen erstellen');
        } else {
            prompts.push('Rechnungsprüfung nach §14 UStG durchführen');
            prompts.push('Rechnung zur Zahlung freigeben');
        }
    }
    
    if (content.includes('zahlung')) {
        prompts.push('Zahlungseingang verbuchen');
        prompts.push('Offene Posten abgleichen');
    }
    
    if (content.includes('kredit') || content.includes('limit')) {
        prompts.push('Kreditlimit prüfen und anpassen');
        prompts.push('Bonitätsprüfung durchführen');
    }
    
    return prompts.slice(0, 3);
}
