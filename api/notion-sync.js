// api/notion-sync.js
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Use let instead of const for reassignment
    let notionToken = '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';
    let databaseId = '2578664b1ce78060b6ede4e0c35d1bb4';
    
    // Override with body params if provided
    if (req.method === 'POST' && req.body) {
      if (req.body.notionToken) notionToken = req.body.notionToken;
      if (req.body.databaseId) databaseId = req.body.databaseId;
    }
    
    console.log('🔗 Connecting to Notion...');
    
    // Initialize Notion Client
    const notion = new Client({
      auth: notionToken
    });

    // Query the database
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100
    });

    console.log(`📚 Found ${response.results.length} prompts in Notion`);

    // Transform Notion pages to our prompt format
    const prompts = response.results.map(page => {
      try {
        const properties = page.properties;
        
        return {
          id: page.id,
          metadata: {
            title: properties.Name?.title?.[0]?.plain_text || 
                   properties.Title?.title?.[0]?.plain_text || 
                   'Untitled',
            category: properties.Category?.select?.name || 
                     properties.Kategorie?.select?.name || 
                     'General',
            role: properties.Role?.select?.name || 
                  properties.Rolle?.select?.name || 
                  'Controller',
            complexity: properties.Complexity?.select?.name || 
                       properties.Komplexität?.select?.name || 
                       'medium'
          },
          content: {
            full: properties.Content?.rich_text?.[0]?.plain_text || 
                  properties.Inhalt?.rich_text?.[0]?.plain_text ||
                  properties.Prompt?.rich_text?.[0]?.plain_text ||
                  ''
          },
          notionUrl: page.url
        };
      } catch (error) {
        console.error('Error parsing page:', error);
        return null;
      }
    }).filter(prompt => prompt !== null);

    return res.status(200).json({
      success: true,
      count: prompts.length,
      prompts: prompts,
      message: prompts.length > 0 ? 
        '✅ Notion Prompts erfolgreich geladen!' : 
        '⚠️ Keine Prompts gefunden - prüfe die Notion-Verbindung'
    });

  } catch (error) {
    console.error('Notion sync error:', error);
    
    // Bessere Fehlerbehandlung
    if (error.code === 'unauthorized') {
      return res.status(401).json({ 
        error: 'Notion Zugriff verweigert',
        details: 'Token ungültig oder Integration nicht verbunden',
        solution: 'Prüfe ob die Integration mit der Datenbank verbunden ist'
      });
    }
    
    if (error.code === 'object_not_found') {
      return res.status(404).json({ 
        error: 'Datenbank nicht gefunden',
        details: 'Die Database ID existiert nicht oder ist nicht zugänglich',
        solution: 'Prüfe die Database ID und Verbindung'
      });
    }
    
    return res.status(500).json({ 
      error: 'Notion sync fehlgeschlagen',
      details: error.message,
      code: error.code
    });
  }
};
