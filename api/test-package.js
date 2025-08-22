// api/test-package.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const results = {
    envVars: {
      hasToken: !!process.env.NOTION_TOKEN,
      hasDbId: !!process.env.NOTION_DATABASE_ID,
      tokenStart: process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.substring(0, 10) + '...' : 'NOT SET',
      dbIdStart: process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.substring(0, 10) + '...' : 'NOT SET'
    },
    packageTest: {
      notionClient: false,
      error: null
    }
  };
  
  try {
    // Test ob Package existiert
    const { Client } = require('@notionhq/client');
    results.packageTest.notionClient = true;
    results.packageTest.version = require('@notionhq/client/package.json').version;
  } catch (error) {
    results.packageTest.error = error.message;
  }
  
  return res.status(200).json(results);
};