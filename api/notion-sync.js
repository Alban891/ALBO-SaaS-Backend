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
    // HARDCODED für jetzt - später aus Environment Variables
    const NOTION_TOKEN = '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';
    const DATABASE_ID = '2578664b1ce78060b6ede4e0c35d1bb4';
    
    // Für POST mit custom Token/ID
    if (req.method === 'POST' && req.body) {
      const { notionToken, databaseId } = req.body;
      if (notionToken && databaseId) {
        NOTION_TOKEN = notionToken;
        DATABASE_ID = databaseId;
      }
    }
    
    console.log('🔗 Connecting to Notion...');
    
    // Initialize Notion Client
    const notion = new Client({
      auth: NOTION_TOKEN
    });

    // Query the database
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 100
    });

    console.log(`📚 Found ${response.results.length} prompts in Notion`);

    // Transform Notion pages to our prompt format
    const prompts = response.results.map(page => {
      try {
        const properties = page.properties;
        
        // Debug
        console.log('Available properties:', Object.keys(properties));
        
        return {
          id: page.id,
          metadata: {
            // WICHTIG: "Name" statt "Title"!
            title: properties.Name?.title?.[0]?.plain_text || 
                   properties.Title?.title?.[0]?.plain_text || 
                   'Untitled',
            category: properties.Category?.select?.name || 'General',
            role: properties.Role?.select?.name || 'Controller',
            complexity: properties.Complexity?.select?.name || 'medium',
            tags: properties.Tags?.multi_select?.map(tag => tag.name) || []
          },
          content: {
            // Versuche verschiedene Content-Felder
            full: properties.Content?.rich_text?.[0]?.plain_text || 
                  properties.Prompt?.rich_text?.[0]?.plain_text ||
                  properties.Description?.rich_text?.[0]?.plain_text ||
                  ''
          },
          notionUrl: page.url,
          // Füge raw properties für Debug hinzu
          _debug: {
            availableFields: Object.keys(properties)
          }
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
      database: {
        id: DATABASE_ID,
        propertiesAvailable: response.results[0] ? 
          Object.keys(response.results[0].properties) : []
      }
    });

  } catch (error) {
    console.error('Notion sync error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync with Notion',
      details: error.message,
      code: error.code
    });
  }
};
