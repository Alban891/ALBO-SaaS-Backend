// api/prompts.js
const ALBO_PROMPTS = require('./prompts-data.js');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Alle Prompts zurückgeben
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      count: ALBO_PROMPTS.length,
      prompts: ALBO_PROMPTS
    });
  }

  // POST: Prompt mit Antworten füllen
  if (req.method === 'POST') {
    const { promptId, answers } = req.body;
    
    const prompt = ALBO_PROMPTS.find(p => p.id === promptId);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Template mit Antworten füllen
    let filledPrompt = prompt.promptTemplate;
    Object.keys(answers || {}).forEach(key => {
      const value = answers[key];
      filledPrompt = filledPrompt.replace(
        new RegExp(`{{${key}}}`, 'g'),
        value
      );
    });

    return res.status(200).json({
      success: true,
      promptId: promptId,
      filledPrompt: filledPrompt
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};