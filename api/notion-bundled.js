// api/notion-bundled.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!token || !databaseId) {
    return res.status(500).json({
      error: 'Missing environment variables',
      hasToken: !!token,
      hasDb: !!databaseId
    });
  }
  
  try {
    // Direkte Notion API ohne SDK
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100
      })
    });
    
    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform the data
    const prompts = data.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.Name?.title?.[0]?.plain_text || 'Untitled',
        category: props.Category?.select?.name || 'General',
        role: props.Role?.select?.name || 'Controller',
        content: props.Content?.rich_text?.[0]?.plain_text || ''
      };
    });
    
    return res.status(200).json({
      success: true,
      count: prompts.length,
      prompts: prompts
    });
    
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};