const express = require('express');
const { pool } = require('../database/connection');
const { config } = require('../config');

const router = express.Router();

router.get('/', async (req, res) => {
  let dbStatus = 'ok';
  try {
    const client = await pool.connect();
    client.release();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 200 : 503;
  res.status(status).json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    env: config.server.nodeEnv,
    services: {
      database: dbStatus,
      whatsapp: config.whatsapp.accessToken ? 'configured' : 'not_configured',
      openai: config.openai.apiKey ? 'configured' : 'not_configured',
      srProprietario: config.srProprietario.apiKey ? 'configured' : 'not_configured',
      imoview: config.imoview.apiKey ? 'configured' : 'not_configured',
    },
  });
});

module.exports = router;
