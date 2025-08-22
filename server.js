const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - WICHTIG: CORS richtig konfigurieren für Outlook
app.use(cors({
    origin: [
        'https://albo-ki-agent.vercel.app',
        'https://alban891.github.io',
        'http://localhost:3000',
        'https://localhost:3001',
        'https://outlook.office.com',
        'https://outlook.office365.com',
        '*' // Für Entwicklung - später einschränken
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));
app.use(express.json());

// ===== EXISTING STATUS ROUTE =====
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'ALBO Multi-Tenant SaaS Backend läuft!',
        timestamp: new Date().toISOString(),
        features: {
            tenant_management: true,
            ai_processing: true,
            analytics: true
        }
    });
});

// ===== EXISTING: TENANT ONBOARDING =====
app.post('/api/onboard-tenant', (req, res) => {
    const { company_name, domain, admin_email, tier = 'professional' } = req.body;
    
    if (!company_name || !domain || !admin_email) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: company_name, domain, admin_email'
        });
    }
    
    const tenantId = `albo_${domain.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
    
    res.json({
        success: true,
        tenant_id: tenantId,
        message: `Welcome to ALBO! ${company_name} has been onboarded.`,
        setup_urls: {
            admin_dashboard: `https://app.albo.ai/admin/${tenantId}`,
            add_in_manifest: `https://localhost:3001/api/manifest/${tenantId}.xml`
        },
        billing_info: {
            tier: tier,
            price_per_user: tier === 'enterprise' ? 299 : tier === 'professional' ? 89 : 29,
            trial_period_days: 14
        }
    });
});

// ===== NEU: FRONTEND INTEGRATION - Email Analysis =====
app.post('/api/analyze-email', async (req, res) => {
    try {
        const { subject, from, body, agentType } = req.body;
        const tenantId = req.headers['x-tenant-id'] || 'demo_tenant';
        
        console.log('📧 Analyzing email for tenant:', tenantId);
        console.log('Subject:', subject);
        console.log('Agent:', agentType);
        
        // Keyword-basierte Analyse
        const text = `${subject} ${body || ''}`.toLowerCase();
        
        // Kategorisierung
        let category = 'general';
        let priority = 'normal';
        let confidence = 75;
        
        if (text.includes('mahnung') || text.includes('überfällig') || text.includes('reminder')) {
            category = 'mahnung';
            priority = 'high';
            confidence = 90;
        } else if (text.includes('rechnung') || text.includes('invoice')) {
            category = 'rechnung';
            priority = 'medium';
            confidence = 85;
        } else if (text.includes('angebot') || text.includes('quote')) {
            category = 'angebot';
            priority = 'low';
            confidence = 80;
        }
        
        // Betrag extrahieren
        const amountMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:eur|euro|€)/i);
        const amount = amountMatch ? amountMatch[1] : null;
        
        res.json({
            success: true,
            analysis: {
                summary: `${category === 'mahnung' ? 'Zahlungserinnerung' : category === 'rechnung' ? 'Rechnung' : 'Geschäfts-E-Mail'} von ${from}`,
                category: category,
                priority: priority,
                amount: amount,
                confidence: confidence,
                suggestedAction: getActionForCategory(category),
                tenant: tenantId
            }
        });
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== NEU: PROCESS EMAIL (für Preview, Auto, Draft) =====
app.post('/api/process-email', async (req, res) => {
    try {
        const { emailData, agent, action } = req.body;
        const tenantId = req.headers['x-tenant-id'] || 'demo_tenant';
        
        console.log(`🔄 Processing ${action} for tenant ${tenantId}`);
        
        let result = {};
        
        switch(action) {
            case 'preview':
                result = await generatePreview(emailData, agent);
                break;
                
            case 'auto':
                result = await processAutomatic(emailData, agent, tenantId);
                break;
                
            case 'draft':
                result = await generateDraft(emailData, agent);
                break;
                
            case 'dashboard':
                result = await prepareForDashboard(emailData, agent, tenantId);
                break;
                
            default:
                throw new Error('Unknown action: ' + action);
        }
        
        res.json({
            success: true,
            action: action,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Process error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== NEU: AGENT SUGGESTION =====
app.post('/api/suggest-agent', async (req, res) => {
    try {
        const { subject, body, from } = req.body;
        const text = `${subject} ${body || ''}`.toLowerCase();
        
        let suggestedAgent = 'controller';
        let confidence = 60;
        let reason = 'Standard-Zuweisung';
        
        // Pattern Matching für Agent-Auswahl
        if (text.includes('rechnung') || text.includes('invoice') || text.includes('lieferant')) {
            suggestedAgent = 'kreditor';
            confidence = 90;
            reason = 'Rechnungsbezogene Schlüsselwörter erkannt';
        } else if (text.includes('mahnung') || text.includes('forderung') || text.includes('überfällig')) {
            suggestedAgent = 'debitor';
            confidence = 85;
            reason = 'Mahnungsbezogene Inhalte erkannt';
        } else if (text.includes('budget') || text.includes('forecast') || text.includes('kpi')) {
            suggestedAgent = 'controller';
            confidence = 80;
            reason = 'Controlling-relevante Themen';
        } else if (text.includes('strategie') || text.includes('board') || text.includes('investor')) {
            suggestedAgent = 'cfo';
            confidence = 75;
            reason = 'Strategische Themen erkannt';
        }
        
        res.json({
            success: true,
            suggestion: {
                agent: suggestedAgent,
                confidence: confidence,
                reason: reason
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== EXISTING: TENANT EMAIL PROCESSING =====
app.post('/api/tenant/:tenantId/process-email', (req, res) => {
    const { tenantId } = req.params;
    const { user_email, email_content, agent_type, action_type } = req.body;
    
    if (!user_email || !email_content || !agent_type || !action_type) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    // Agent-spezifische Antworten
    const responses = {
        kreditor: {
            analysis: 'Kreditorenbuchhalter: Rechnung erkannt, zur Zahlung vorgemerkt.',
            draft_response: 'Sehr geehrte Damen und Herren,\n\nwir bestätigen den Erhalt Ihrer Rechnung. Diese wurde zur Prüfung an unsere Kreditorenbuchhaltung weitergeleitet.\n\nMit freundlichen Grüßen\nIhr ALBO Finance Team'
        },
        debitor: {
            analysis: 'Debitorenbuchhalter: Mahnung verarbeitet, Zahlungsstatus geprüft.',
            draft_response: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Zahlungserinnerung. Wir werden die Zahlung umgehend veranlassen.\n\nMit freundlichen Grüßen\nIhr ALBO Finance Team'
        },
        controller: {
            analysis: 'Controller: Finanzdaten analysiert, Budget-Impact bewertet.',
            draft_response: 'Sehr geehrte Damen und Herren,\n\nIhre Anfrage wurde durch unser Controlling geprüft. Wir melden uns zeitnah mit einer detaillierten Rückmeldung.\n\nMit freundlichen Grüßen\nIhr ALBO Finance Team'
        },
        cfo: {
            analysis: 'CFO-Level: Strategische Bewertung durchgeführt.',
            draft_response: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Nachricht. Diese wurde zur strategischen Bewertung an unser Management weitergeleitet.\n\nMit freundlichen Grüßen\nIhr ALBO Executive Team'
        }
    };
    
    const result = responses[agent_type] || responses['controller'];
    
    res.json({
        success: true,
        tenant_id: tenantId,
        result: {
            ...result,
            confidence: 95,
            agent_used: agent_type,
            action_performed: action_type,
            processed_at: new Date().toISOString()
        },
        usage_info: {
            requests_remaining: 9500,
            tier: 'professional'
        }
    });
});

// ===== EXISTING: CUSTOM MANIFEST GENERATION =====
app.get('/api/manifest/:tenantId.xml', (req, res) => {
    const { tenantId } = req.params;
    
    const manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" 
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
           xsi:type="MailApp">
  
  <Id>f8437405-f9fc-4292-9c48-3aff00027c5b</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>ALBO Solutions</ProviderName>
  <DefaultLocale>de-DE</DefaultLocale>
  
  <DisplayName DefaultValue="ALBO KI Finance Agent - ${tenantId}"/>
  <Description DefaultValue="Enterprise Finance Intelligence für Ihr Unternehmen - Tenant: ${tenantId}"/>
  
  <IconUrl DefaultValue="https://alban891.github.io/ALBO-KI-Agent/assets/icon-64.png"/>
  <HighResolutionIconUrl DefaultValue="https://alban891.github.io/ALBO-KI-Agent/assets/icon-128.png"/>
  
  <SupportUrl DefaultValue="https://support.albo.ai"/>
  
  <AppDomains>
    <AppDomain>https://alban891.github.io</AppDomain>
    <AppDomain>https://localhost:3001</AppDomain>
  </AppDomains>
  
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>
  
  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://alban891.github.io/ALBO-KI-Agent/taskpane.html?tenant=${tenantId}"/>
        <RequestedHeight>450</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  
  <Permissions>ReadWriteItem</Permissions>
  
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
  </Rule>
  
</OfficeApp>`;
    
    res.set('Content-Type', 'application/xml');
    res.send(manifest);
});

// ========== HELPER FUNCTIONS ==========

function getActionForCategory(category) {
    const actions = {
        'mahnung': 'Sofortige Zahlung veranlassen oder Zahlungsplan vereinbaren',
        'rechnung': 'Rechnung prüfen und zur Zahlung freigeben',
        'angebot': 'Angebot bewerten und Entscheidung treffen',
        'general': 'E-Mail zur weiteren Bearbeitung weiterleiten'
    };
    return actions[category] || actions['general'];
}

async function generatePreview(emailData, agent) {
    const text = `${emailData.subject} ${emailData.body || ''}`.toLowerCase();
    
    // Analyse
    let category = 'general';
    if (text.includes('mahnung')) category = 'mahnung';
    else if (text.includes('rechnung')) category = 'rechnung';
    
    const amountMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:eur|euro|€)/i);
    const amount = amountMatch ? amountMatch[1] : null;
    
    return {
        emailAnalysis: {
            subject: emailData.subject,
            from: emailData.from,
            category: category,
            amount: amount,
            priority: category === 'mahnung' ? 'HOCH' : 'Normal',
            urgencyLevel: category === 'mahnung' ? '🚨' : '📊'
        },
        agentResponse: {
            analysis: `${agent} hat die E-Mail analysiert. ${category === 'mahnung' ? 'Dringende Bearbeitung erforderlich.' : 'Standard-Workflow anwendbar.'}`,
            recommendation: getActionForCategory(category),
            action_taken: `Analyse durch ${agent} abgeschlossen`
        },
        recommendedActions: `Vorschau für ${category} generiert`,
        confidence: '92%'
    };
}

async function processAutomatic(emailData, agent, tenantId) {
    console.log(`🚀 Auto-processing for tenant ${tenantId}`);
    
    // Hier würde die echte E-Mail-Verarbeitung stattfinden
    // Z.B. über Microsoft Graph API oder SMTP
    
    return {
        status: 'completed',
        message: 'E-Mail wurde automatisch verarbeitet und beantwortet',
        processedBy: agent,
        tenant: tenantId,
        timestamp: new Date().toISOString()
    };
}

async function generateDraft(emailData, agent) {
    const templates = {
        'kreditor': `Sehr geehrte Damen und Herren,

vielen Dank für die Übersendung der Rechnung.
Die Rechnung wird geprüft und nach Freigabe zur Zahlung angewiesen.

Mit freundlichen Grüßen
Kreditorenbuchhaltung
ALBO Finance Team`,

        'debitor': `Sehr geehrte Damen und Herren,

wir haben Ihre Zahlungserinnerung erhalten.
Die Zahlung wird umgehend veranlasst.

Mit freundlichen Grüßen
Debitorenbuchhaltung
ALBO Finance Team`,

        'controller': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Nachricht.
Ihr Anliegen wurde an unser Controlling weitergeleitet.

Mit freundlichen Grüßen
Controlling
ALBO Finance Team`
    };
    
    return {
        to: emailData.from,
        subject: `RE: ${emailData.subject}`,
        body: templates[agent] || templates['controller'],
        metadata: {
            generatedBy: agent,
            timestamp: new Date().toISOString()
        }
    };
}

async function prepareForDashboard(emailData, agent, tenantId) {
    const sessionId = `session_${tenantId}_${Date.now()}`;
    
    // Hier würde Session in Datenbank gespeichert
    console.log(`📊 Dashboard session created: ${sessionId}`);
    
    return {
        sessionId: sessionId,
        dashboardUrl: `https://localhost:3001/dashboard?session=${sessionId}&tenant=${tenantId}`,
        expiresIn: 3600,
        data: {
            email: emailData,
            agent: agent,
            tenant: tenantId
        }
    };
}

// ===== DASHBOARD ROUTE =====
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// ===== ERROR HANDLING =====
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint ${req.path} not found`,
        available_endpoints: [
            'GET /api/status',
            'POST /api/analyze-email',
            'POST /api/process-email',
            'POST /api/suggest-agent',
            'POST /api/onboard-tenant',
            'POST /api/tenant/:tenantId/process-email',
            'GET /api/manifest/:tenantId.xml',
            'GET /health',
            'GET /dashboard'
        ]
    });
});

// Vereinfachter Export für Vercel
if (process.env.VERCEL) {
    // Für Vercel - nur App exportieren
    module.exports = app;
} else {
    // Lokale Entwicklung
    const PORT = process.env.PORT || 3001;
    
    try {
        const certPath = path.join(__dirname, 'certs', 'localhost.pem');
        const keyPath = path.join(__dirname, 'certs', 'localhost-key.pem');
        
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
            // HTTPS Server
            const https = require('https');
            const options = {
                cert: fs.readFileSync(certPath),
                key: fs.readFileSync(keyPath)
            };
            
            https.createServer(options, app).listen(PORT, () => {
                console.log(`🚀 ALBO Backend läuft auf https://localhost:${PORT}`);
            });
        } else {
            // HTTP Server
            app.listen(PORT, () => {
                console.log(`🚀 ALBO Backend läuft auf http://localhost:${PORT}`);
            });
        }
    } catch (error) {
        // Fallback auf HTTP
        app.listen(PORT, () => {
            console.log(`🚀 ALBO Backend läuft auf Port ${PORT}`);
        });
    }
}