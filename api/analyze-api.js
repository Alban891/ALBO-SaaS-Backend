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
        const { emailContent, agent, needsAgentDetection } = req.body;
        console.log('Email Subject:', emailContent?.subject);
        console.log('Agent:', agent);
        console.log('Needs Agent Detection:', needsAgentDetection);

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
                    fullAnalysis: "Der OpenAI API Key wurde noch nicht in Vercel konfiguriert. Ohne diesen Key können keine echten KI-Analysen durchgeführt werden.",
                    suggestedAgent: "Controller",
                    confidence: 0.5,
                    reasoning: "Standardauswahl ohne KI-Analyse"
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

        // ZUERST: Agent-Erkennung wenn benötigt
        let detectedAgent = agent || 'Controller';
        let agentConfidence = 1.0;
        let agentReasoning = 'Manuell ausgewählt';
        
        if (needsAgentDetection || !agent) {
            console.log('Performing AI agent detection...');
            
            const agentDetectionPrompt = `Du bist ein Finance-Experte. Analysiere diese Email und bestimme den passenden Agent.

Verfügbare Agenten und ihre Zuständigkeiten:
- Kreditor: Eingangsrechnungen, Lieferanten, Verbindlichkeiten, Zahlungsausgänge, Bestellungen, Eingangsrechnungsprüfung
- Debitor: Ausgangsrechnungen, Kundenforderungen, Mahnwesen, Zahlungseingänge, Kreditlimits, Forderungsmanagement
- Controller: Reporting, Analysen, Budgets, Forecasts, KPIs, Abweichungsanalysen, Kostenstellenberichte
- Treasury: Liquidität, Cash Management, Währungen, Hedging, Bankkonten, Finanzierungen, Zinsen
- M&A: Mergers, Acquisitions, Due Diligence, Unternehmensbewertung, Deals, Beteiligungen
- Anlagen: Anlagegüter, Abschreibungen, Investitionen, Anlagevermögen, AfA, Sachanlagen

Analysiere die Email und antworte NUR im JSON Format:
{
  "suggestedAgent": "Name des Agents",
  "confidence": 0.85,
  "reasoning": "Kurze präzise Begründung auf Deutsch"
}`;

            const agentDetectionMessage = `Email zur Analyse:
Betreff: ${emailContent.subject}
Von: ${emailContent.from}
Inhalt: ${emailContent.body}`;

            try {
                const agentCompletion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: agentDetectionPrompt },
                        { role: "user", content: agentDetectionMessage }
                    ],
                    temperature: 0.1,
                    max_tokens: 200,
                    response_format: { type: "json_object" }
                });

                const agentResult = JSON.parse(agentCompletion.choices[0].message.content);
                detectedAgent = agentResult.suggestedAgent || 'Controller';
                agentConfidence = agentResult.confidence || 0.7;
                agentReasoning = agentResult.reasoning || 'KI-Analyse durchgeführt';
                
                console.log('Agent detected:', detectedAgent, 'with confidence:', agentConfidence);
            } catch (agentError) {
                console.error('Agent detection failed:', agentError);
                // Fallback bleibt bei default Werten
            }
        }

        // DANN: Hauptanalyse mit dem erkannten/gewählten Agent
        const systemPrompt = `Du bist ein spezialisierter ${detectedAgent} AI-Agent für das deutsche Finanzwesen.

DEINE ROLLE: Als ${detectedAgent} bist du zuständig für:
${getAgentResponsibilities(detectedAgent)}

AUFGABE: Analysiere die folgende E-Mail aus der Perspektive eines ${detectedAgent} und extrahiere ALLE relevanten Informationen für deine Abteilung.

Gib eine strukturierte Antwort in diesem Format:

ZUSAMMENFASSUNG: (2-3 präzise Sätze über den Kern der E-Mail aus ${detectedAgent}-Sicht)

ERKANNTE DETAILS:
${getAgentSpecificDetailsPrompt(detectedAgent)}

ACTION ITEMS:
1. [Konkrete ${detectedAgent}-spezifische Aufgabe 1]
2. [Konkrete ${detectedAgent}-spezifische Aufgabe 2]
3. [Weitere falls nötig]

NÄCHSTE SCHRITTE:
[Klare Handlungsempfehlung aus ${detectedAgent}-Perspektive in 1-2 Sätzen]

KATEGORIEN: [Zutreffende aus deinem Bereich: ${getAgentCategories(detectedAgent)}]

PRIORITÄT: [Hoch/Mittel/Niedrig basierend auf Dringlichkeit für ${detectedAgent}]

GESCHÄTZTER ZEITAUFWAND: [Realistische Schätzung]

SAP-RELEVANZ: [Ja/Nein - Muss dies in SAP gebucht werden?]

${getAgentSpecificInstructions(detectedAgent)}

Sei sehr präzise und professionell. Antworte auf Deutsch.`;

        const userMessage = `E-Mail zur Analyse:
Betreff: ${emailContent.subject}
Von: ${emailContent.from}
An: ${emailContent.to || 'Nicht angegeben'}

Inhalt:
${emailContent.body}`;

        // Hauptanalyse
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.2,
            max_tokens: 1000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

        const aiAnalysis = completion.choices[0].message.content;
        console.log('OpenAI Response received, length:', aiAnalysis.length);

        // Parse die strukturierte Antwort
        const parsedAnalysis = parseStructuredAnalysis(aiAnalysis);
        
        // Füge Agent-Erkennungsergebnisse hinzu
        parsedAnalysis.suggestedAgent = detectedAgent;
        parsedAnalysis.confidence = agentConfidence;
        parsedAnalysis.reasoning = agentReasoning;

        const response = {
            success: true,
            source: 'openai',
            analysis: parsedAnalysis,
            metadata: {
                agent: detectedAgent,
                analyzedAt: new Date().toISOString(),
                model: 'gpt-4o-mini',
                emailLength: emailContent.body ? emailContent.body.length : 0,
                tokensUsed: completion.usage?.total_tokens || 0,
                agentDetection: {
                    performed: needsAgentDetection || !agent,
                    confidence: agentConfidence,
                    reasoning: agentReasoning
                }
            },
            recommendations: {
                suggestedPrompts: extractAgentSpecificPrompts(aiAnalysis, emailContent, detectedAgent),
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
                fullAnalysis: `Ein Fehler ist aufgetreten: ${error.message}`,
                suggestedAgent: "Controller",
                confidence: 0,
                reasoning: "Fehler bei der Analyse"
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

// Neue Hilfsfunktionen für Agent-spezifische Prompts
function getAgentResponsibilities(agent) {
    const responsibilities = {
        'Kreditor': 'Eingangsrechnungsprüfung, Lieferantenverwaltung, Zahlungsausgänge, Verbindlichkeiten, Skonto-Optimierung',
        'Debitor': 'Forderungsmanagement, Mahnwesen, Zahlungseingänge, Kreditlimitprüfung, Kundenkontoführung',
        'Controller': 'Reporting, Budgetierung, Forecast, KPI-Monitoring, Abweichungsanalysen, Kostenstellenrechnung',
        'Treasury': 'Liquiditätsplanung, Cash Management, Währungsrisiken, Finanzierungen, Zinsmanagement',
        'M&A': 'Due Diligence, Unternehmensbewertung, Deal-Strukturierung, Post-Merger-Integration',
        'Anlagen': 'Anlagenbuchhaltung, AfA-Berechnung, Investitionscontrolling, Asset Management'
    };
    return responsibilities[agent] || 'Allgemeine Finanzaufgaben';
}

function getAgentSpecificDetailsPrompt(agent) {
    const details = {
        'Kreditor': `- Rechnungsnummer: [falls vorhanden]
- Lieferant: [Name]
- Rechnungsbetrag: [Betrag]
- Zahlungsziel: [Datum]
- Skonto: [falls erwähnt]
- Bestellnummer: [falls vorhanden]`,
        'Debitor': `- Rechnungsnummer: [falls vorhanden]
- Kunde: [Name]
- Forderungsbetrag: [Betrag]
- Fälligkeitsstatus: [überfällig/offen/bezahlt]
- Mahnstufe: [falls relevant]
- Kreditlimit: [falls erwähnt]`,
        'Controller': `- Berichtsperiode: [falls erwähnt]
- KPIs/Kennzahlen: [falls vorhanden]
- Budget/Ist-Abweichung: [falls relevant]
- Kostenstelle: [falls erwähnt]
- Forecast-Anpassung: [falls relevant]`,
        'Treasury': `- Liquiditätsbedarf: [falls erwähnt]
- Währung: [falls relevant]
- Zinssatz: [falls vorhanden]
- Bank/Finanzinstitut: [Name]
- Hedging-Bedarf: [falls relevant]`,
        'M&A': `- Target-Unternehmen: [Name falls erwähnt]
- Deal-Volumen: [falls vorhanden]
- Due Diligence Phase: [falls relevant]
- Closing-Datum: [falls erwähnt]
- Synergien: [falls identifiziert]`,
        'Anlagen': `- Anlagennummer: [falls vorhanden]
- Anschaffungswert: [Betrag]
- Nutzungsdauer: [Jahre]
- AfA-Methode: [falls erwähnt]
- Restwert: [falls relevant]`
    };
    return details[agent] || '- Relevante Details extrahieren';
}

function getAgentCategories(agent) {
    const categories = {
        'Kreditor': 'Rechnungsprüfung, Zahlungsfreigabe, Lieferantenkommunikation, Verbindlichkeiten, Skonto',
        'Debitor': 'Mahnwesen, Zahlungseingang, Forderungen, Kreditprüfung, Kundenkommunikation',
        'Controller': 'Reporting, Budget, Forecast, KPI-Analyse, Abweichungen, Kostenkontrolle',
        'Treasury': 'Liquidität, Finanzierung, Währung, Zinsen, Banking, Cash-Management',
        'M&A': 'Due-Diligence, Valuation, Deal-Structuring, Integration, Synergien',
        'Anlagen': 'Anschaffung, Abschreibung, Wartung, Verkauf, Inventur'
    };
    return categories[agent] || 'Finanzwesen, Buchhaltung, Compliance';
}

function getAgentSpecificInstructions(agent) {
    const instructions = {
        'Kreditor': 'ZUSÄTZLICH: Prüfe auf Skonto-Möglichkeiten und Zahlungsfristen. Achte auf Compliance mit Einkaufsrichtlinien.',
        'Debitor': 'ZUSÄTZLICH: Bewerte das Zahlungsausfallrisiko und schlage ggf. Mahnmaßnahmen vor.',
        'Controller': 'ZUSÄTZLICH: Identifiziere Optimierungspotentiale und relevante KPIs für das Management Reporting.',
        'Treasury': 'ZUSÄTZLICH: Bewerte Liquiditätsauswirkungen und Währungsrisiken.',
        'M&A': 'ZUSÄTZLICH: Identifiziere Deal-Breaker und Synergiepotentiale.',
        'Anlagen': 'ZUSÄTZLICH: Prüfe auf steuerliche Optimierungsmöglichkeiten bei Abschreibungen.'
    };
    return instructions[agent] || '';
}

// Erweiterte Hilfsfunktion zum Parsen der strukturierten Antwort
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
        
        // Verschiedene Detail-Typen extrahieren
        const patterns = {
            invoiceNumber: /Rechnungsnummer:?\s*(\S+)/i,
            amount: /(?:Betrag|Rechnungsbetrag|Forderungsbetrag):?\s*([\d,\.]+\s*(?:EUR|€)?)/i,
            status: /(?:status|Fälligkeitsstatus):?\s*(\S+)/i,
            customer: /Kunde:?\s*(.+?)(?=\n|$)/i,
            supplier: /Lieferant:?\s*(.+?)(?=\n|$)/i,
            dueDate: /(?:Zahlungsziel|Fälligkeit):?\s*(.+?)(?=\n|$)/i,
            discount: /Skonto:?\s*(.+?)(?=\n|$)/i
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = details.match(pattern);
            if (match) analysis.extractedDetails[key] = match[1].trim();
        }
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

    // SAP-Relevanz
    const sapMatch = text.match(/SAP-RELEVANZ:?\s*(Ja|Nein)/i);
    if (sapMatch) {
        analysis.sapRelevant = sapMatch[1].toLowerCase() === 'ja';
    }

    return analysis;
}

// Agent-spezifische Prompt-Vorschläge
function extractAgentSpecificPrompts(analysis, emailContent, agent) {
    const prompts = [];
    const content = (analysis + ' ' + emailContent.body).toLowerCase();
    
    const agentPrompts = {
        'Kreditor': {
            keywords: ['rechnung', 'lieferant', 'zahlung', 'bestellung'],
            prompts: [
                'Rechnung zur Zahlung freigeben',
                'Skonto-Frist prüfen und nutzen',
                'Drei-Wege-Abgleich durchführen',
                'Lieferantenstammdaten aktualisieren'
            ]
        },
        'Debitor': {
            keywords: ['mahnung', 'forderung', 'kunde', 'zahlung'],
            prompts: [
                'Mahnlauf starten',
                'Zahlungserinnerung versenden',
                'Kreditlimit überprüfen',
                'Offene Posten abstimmen'
            ]
        },
        'Controller': {
            keywords: ['report', 'budget', 'forecast', 'analyse'],
            prompts: [
                'Monatsbericht erstellen',
                'Budget-Ist-Vergleich durchführen',
                'Forecast aktualisieren',
                'KPI-Dashboard updaten'
            ]
        },
        'Treasury': {
            keywords: ['liquidität', 'währung', 'kredit', 'bank'],
            prompts: [
                'Liquiditätsplanung aktualisieren',
                'Währungshedging prüfen',
                'Kreditlinien optimieren',
                'Cash-Pooling durchführen'
            ]
        },
        'M&A': {
            keywords: ['deal', 'acquisition', 'merger', 'due diligence'],
            prompts: [
                'Due Diligence Checkliste abarbeiten',
                'Valuation Model aktualisieren',
                'Synergiepotentiale quantifizieren',
                'Integration Plan erstellen'
            ]
        },
        'Anlagen': {
            keywords: ['anlage', 'abschreibung', 'investition', 'afa'],
            prompts: [
                'AfA-Lauf durchführen',
                'Anlagenzugang buchen',
                'Inventur vorbereiten',
                'Investitionsantrag prüfen'
            ]
        }
    };
    
    const agentConfig = agentPrompts[agent] || agentPrompts['Controller'];
    
    // Prüfe Keywords und füge relevante Prompts hinzu
    for (const keyword of agentConfig.keywords) {
        if (content.includes(keyword)) {
            prompts.push(...agentConfig.prompts.slice(0, 2));
            break;
        }
    }
    
    // Falls keine Keywords gefunden, nutze Standard-Prompts
    if (prompts.length === 0) {
        prompts.push(...agentConfig.prompts.slice(0, 3));
    }
    
    return [...new Set(prompts)].slice(0, 3); // Deduplizieren und max 3 zurückgeben
}
