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
    // SICHER: Aus Environment Variables!
    const notionToken = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    // Check ob Variables existieren
    if (!notionToken || !databaseId) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Notion credentials not configured',
        hint: 'Environment variables NOTION_TOKEN and NOTION_DATABASE_ID must be set in Vercel'
      });
    }
    
    console.log('🔗 Connecting to Notion with secure credentials...');
    
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
                     'medium',
          content: properties.Content?.rich_text?.[0]?.plain_text || 
                   properties.Inhalt?.rich_text?.[0]?.plain_text ||
                   properties.Prompt?.rich_text?.[0]?.plain_text ||
                   '',
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
      message: `✅ ${prompts.length} Prompts aus Notion geladen!`
    });

  } catch (error) {
    console.error('Notion sync error:', error);
    
    // Detaillierte Fehlerbehandlung
    if (error.code === 'unauthorized') {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Notion API Token ist ungültig',
        solution: 'Prüfe NOTION_TOKEN in Vercel Environment Variables'
      });
    }
    
    if (error.code === 'object_not_found') {
      return res.status(404).json({ 
        error: 'Database not found',
        message: 'Die Notion Datenbank wurde nicht gefunden',
        solution: 'Prüfe NOTION_DATABASE_ID und ob die Integration verbunden ist'
      });
    }
    
    return res.status(500).json({ 
      error: 'Notion sync failed',
      message: error.message,
      code: error.code || 'unknown'
    });
  }
};
