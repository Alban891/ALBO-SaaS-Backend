export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  res.status(200).json({
    success: true,
    message: 'ALBO Backend läuft auf Vercel!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
