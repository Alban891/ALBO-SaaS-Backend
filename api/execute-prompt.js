// api/execute-prompt.js
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
        const { 
            prompt, 
            context, 
            emailData,
            agent = 'Controller',
            temperature = 0.3,
            maxTokens = 1500
        } = req.body;

        console.log('Execute Prompt Request:', { prompt: prompt?.substring(0, 100), agent, hasContext: !!context, hasEmail: !!emailData });

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Check if OpenAI API key exists
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not set!');
            return res.status(200).json({
                success: false,
                source: 'mock',
                result: '⚠️ OpenAI API Key nicht konfiguriert. Dies ist eine Mock-Antwort. Bitte OPENAI_API_KEY in Vercel Environment Variables hinzufügen.',
                error: 'No API key configured'
            });
        }

        // Build system prompt based on agent and context
        let systemPrompt = `Du bist ein hochspezialisierter ${agent} AI-Agent für das deutsche Finanzwesen bei ALBO Solutions.
        
Deine Aufgaben:
- Präzise und professionelle Finanzanalysen
- Compliance mit deutschen Steuer- und Handelsgesetzen
- Klare, strukturierte Antworten
- Praktische, umsetzbare Empfehlungen

Antworte immer auf Deutsch und verwende deutsche Fachbegriffe.`;

        // Add email context if available
        let userMessage = prompt;
        
        if (emailData) {
            systemPrompt += `\n\nKontext: Du bearbeitest gerade eine E-Mail mit folgenden Details:
- Betreff: ${emailData.subject}
- Von: ${emailData.from}
- Inhalt: ${emailData.body}`;
            
            userMessage = `Im Kontext der oben genannten E-Mail: ${prompt}`;
        } else if (context) {
            userMessage = `Kontext: ${context}\n\nAufgabe: ${prompt}`;
        }

        console.log('Calling OpenAI API...');

        // OpenAI API Call
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: temperature,
            max_tokens: maxTokens,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

        const aiResponse = completion.choices[0].message.content;
        console.log('OpenAI Response received, length:', aiResponse.length);

        // Format the response
        const response = {
            success: true,
            source: 'openai',
            result: aiResponse,
            metadata: {
                agent: agent,
                model: 'gpt-4o-mini',
                promptLength: prompt.length,
                responseLength: aiResponse.length,
                tokensUsed: completion.usage?.total_tokens || 0,
                timestamp: new Date().toISOString()
            },
            formatting: analyzeResponseFormat(aiResponse)
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Execute Prompt Error:', error);
        
        // Detailed error response
        let errorMessage = 'Fehler bei der Prompt-Ausführung';
        let errorDetails = error.message;
        
        if (error.message?.includes('401')) {
            errorMessage = 'API Key ungültig';
            errorDetails = 'Bitte prüfen Sie den OpenAI API Key in Vercel';
        } else if (error.message?.includes('429')) {
            errorMessage = 'Rate Limit erreicht';
            errorDetails = 'Zu viele Anfragen - bitte warten Sie einen Moment';
        } else if (error.message?.includes('openai')) {
            errorMessage = 'OpenAI Verbindungsfehler';
            errorDetails = 'Konnte keine Verbindung zu OpenAI herstellen';
        }

        return res.status(200).json({
            success: false,
            source: 'error',
            error: errorMessage,
            details: errorDetails,
            result: `❌ ${errorMessage}: ${errorDetails}`
        });
    }
};

// Helper function to analyze response format
function analyzeResponseFormat(text) {
    const format = {
        hasLists: false,
        hasNumbers: false,
        hasHeaders: false,
        hasTables: false,
        hasCode: false,
        sections: []
    };

    // Check for lists
    if (text.match(/^[-•*]\s/m) || text.match(/^\d+\.\s/m)) {
        format.hasLists = true;
    }

    // Check for numbers/calculations
    if (text.match(/\d+[.,]\d+\s*(€|EUR|%)/)) {
        format.hasNumbers = true;
    }

    // Check for headers (lines followed by colon or in caps)
    if (text.match(/^[A-ZÄÖÜ][A-ZÄÖÜ\s]+:/m) || text.match(/^#{1,3}\s/m)) {
        format.hasHeaders = true;
    }

    // Check for table-like structures
    if (text.includes('|') && text.split('\n').some(line => line.split('|').length > 2)) {
        format.hasTables = true;
    }

    // Check for code blocks
    if (text.includes('```') || text.includes('    ')) {
        format.hasCode = true;
    }

    // Extract main sections
    const sectionMatches = text.match(/^([A-ZÄÖÜ][^:]+):/gm);
    if (sectionMatches) {
        format.sections = sectionMatches.map(s => s.replace(':', '').trim());
    }

    return format;
}
