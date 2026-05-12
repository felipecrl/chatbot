const express = require('express');
const { config } = require('../config');
const { handleMessage } = require('../handlers/messageHandler');
const { extractMessage } = require('../services/whatsapp');
const logger = require('../utils/logger');

const router = express.Router();

// Verificação do webhook pela Meta (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verificado com sucesso pela Meta');
    return res.status(200).send(challenge);
  }

  logger.warn('Tentativa de verificação de webhook com token inválido');
  return res.status(403).json({ error: 'Token inválido' });
});

// Recebimento de mensagens (POST)
router.post('/', async (req, res) => {
  // Responde 200 imediatamente para a Meta não reenviar
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    const message = extractMessage(body);

    if (!message) return;
    if (message.type !== 'text') {
      logger.debug('Tipo de mensagem não suportado', { type: message.type, from: message.from });
      return;
    }

    // Processa em background para não bloquear
    handleMessage(message).catch((err) => {
      logger.error('Erro não tratado no handler', { error: err.message, stack: err.stack });
    });
  } catch (err) {
    logger.error('Erro ao processar webhook', { error: err.message });
  }
});

module.exports = router;
