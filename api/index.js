export default function handler(req, res) {
  res.status(200).json({
    message: 'ALBO Backend API',
    endpoints: {
      status: '/api/status',
      analyze: '/api/analyze-ai',
      execute: '/api/execute-prompt',
      dashboard: '/dashboard'
    }
  });
}