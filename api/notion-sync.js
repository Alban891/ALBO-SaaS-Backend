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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { notionToken, databaseId } = req.body;

    if (!notionToken || !databaseId) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['notionToken', 'databaseId']
      });
    }

    console.log('🔗 Connecting to Notion...');
    
    // Initialize Notion Client
    const notion = new Client({
      auth: notionToken
    });

    // Query the database
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100 // Max 100 per request
    });

    console.log(`📚 Found ${response.results.length} prompts in Notion`);

    // Transform Notion pages to our prompt format
    const prompts = response.results.map(page => {
      try {
        // Extract properties (anpassen an deine Notion-Struktur!)
        const properties = page.properties;
        
        return {
          id: page.id,
          metadata: {
            title: properties.Title?.title[0]?.text?.content || 'Untitled',
            category: properties.Category?.select?.name || 'Uncategorized',
            role: properties.Role?.select?.name || 'Controller',
            complexity: properties.Complexity?.select?.name || 'medium',
            tags: properties.Tags?.multi_select?.map(tag => tag.name) || []
          },
          content: {
            // Hier musst du an deine Struktur anpassen
            full: properties.Content?.rich_text[0]?.text?.content || ''
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
      prompts: prompts
    });

  } catch (error) {
    console.error('Notion sync error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync with Notion',
      details: error.message 
    });
  }
};