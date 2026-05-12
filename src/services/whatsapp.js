const axios = require('axios');
const { config } = require('../config');
const logger = require('../utils/logger');

const api = axios.create({
  baseURL: `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}`,
  headers: {
    Authorization: `Bearer ${config.whatsapp.accessToken}`,
    'Content-Type': 'application/json',
  },
});

async function sendText(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const response = await api.post('/messages', payload);
    logger.debug('Mensagem de texto enviada', { to, messageId: response.data.messages?.[0]?.id });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar mensagem de texto', {
      to,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

async function sendImage(to, imageUrl, caption) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  };

  try {
    const response = await api.post('/messages', payload);
    logger.debug('Imagem enviada', { to, imageUrl });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar imagem', { to, error: err.response?.data || err.message });
    throw err;
  }
}

async function sendImovel(to, imovel) {
  const descricao = formatImovelMensagem(imovel);

  if (imovel.fotos && imovel.fotos.length > 0) {
    await sendImage(to, imovel.fotos[0], descricao);
  } else {
    await sendText(to, descricao);
  }
}

async function sendMultiplosImoveis(to, imoveis) {
  for (const imovel of imoveis) {
    await sendImovel(to, imovel);
    await delay(500);
  }
}

async function markAsRead(messageId) {
  try {
    await api.post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch (err) {
    logger.debug('Erro ao marcar mensagem como lida', { messageId, error: err.message });
  }
}

function extractMessage(body) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    return {
      messageId: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || '',
      contactName: contact?.profile?.name || '',
    };
  } catch {
    return null;
  }
}

function formatImovelMensagem(imovel) {
  const partes = [];

  partes.push(`🏠 *${imovel.tipo || 'Imóvel'} - ${imovel.bairro || imovel.cidade}*`);

  if (imovel.preco) {
    const precoFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(imovel.preco);
    partes.push(`💰 ${precoFormatado}${imovel.modalidade === 'aluguel' ? '/mês' : ''}`);
  }

  const detalhes = [];
  if (imovel.metragem) detalhes.push(`${imovel.metragem}m²`);
  if (imovel.quartos) detalhes.push(`${imovel.quartos} quartos`);
  if (imovel.banheiros) detalhes.push(`${imovel.banheiros} banheiros`);
  if (imovel.vagas) detalhes.push(`${imovel.vagas} vaga(s)`);
  if (detalhes.length > 0) partes.push(`📐 ${detalhes.join(' | ')}`);

  if (imovel.amenidades && imovel.amenidades.length > 0) {
    partes.push(`✨ ${imovel.amenidades.slice(0, 4).join(', ')}`);
  }

  if (imovel.codigo) partes.push(`🔑 Código: ${imovel.codigo}`);

  return partes.join('\n');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendText, sendImage, sendImovel, sendMultiplosImoveis, markAsRead, extractMessage };
