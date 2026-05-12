const axios = require('axios');
const { config } = require('../config');
const logger = require('../utils/logger');
const { query } = require('../database/connection');

const api = axios.create({
  baseURL: config.imoview.apiUrl,
  headers: {
    Authorization: `Bearer ${config.imoview.apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Cria ou atualiza um lead no IMOVIEW CRM.
 * Ajuste os campos conforme a documentação da API do IMOVIEW.
 */
async function criarLead({ nome, telefone, email, imovelCodigo, origem }) {
  if (!config.imoview.apiKey) {
    logger.warn('IMOVIEW não configurado — lead salvo apenas localmente');
    return { id: `LOCAL_${Date.now()}`, simulado: true };
  }

  try {
    const payload = {
      empresa_id: config.imoview.empresaId,
      nome,
      telefone,
      email,
      imovel_codigo: imovelCodigo,
      origem: origem || 'WhatsApp Chatbot',
      canal: 'whatsapp',
    };

    const response = await api.post('/leads', payload);
    const leadId = response.data.id || response.data.lead_id || response.data.data?.id;
    logger.info('Lead criado no IMOVIEW', { leadId, nome, telefone });
    return { id: leadId };
  } catch (err) {
    logger.error('Erro ao criar lead no IMOVIEW', {
      error: err.response?.data || err.message,
    });
    // Não lança erro para não interromper o fluxo — lead fica salvo no banco local
    return { id: null, erro: err.message };
  }
}

/**
 * Cria um agendamento de visita no IMOVIEW CRM.
 */
async function criarAgendamento({ leadId, imovelCodigo, dataHora, clienteNome }) {
  if (!config.imoview.apiKey || !leadId) {
    logger.warn('IMOVIEW não configurado ou sem leadId — agendamento salvo apenas localmente');
    return { id: `LOCAL_${Date.now()}`, simulado: true };
  }

  try {
    const payload = {
      empresa_id: config.imoview.empresaId,
      lead_id: leadId,
      imovel_codigo: imovelCodigo,
      data_visita: dataHora,
      tipo: 'visita',
      observacao: `Agendado via WhatsApp Chatbot para ${clienteNome}`,
    };

    const response = await api.post('/agendamentos', payload);
    const agendamentoId =
      response.data.id || response.data.agendamento_id || response.data.data?.id;
    logger.info('Agendamento criado no IMOVIEW', { agendamentoId, imovelCodigo, dataHora });
    return { id: agendamentoId };
  } catch (err) {
    logger.error('Erro ao criar agendamento no IMOVIEW', {
      error: err.response?.data || err.message,
    });
    return { id: null, erro: err.message };
  }
}

/**
 * Registra o lead e agendamento no banco local e tenta sincronizar com IMOVIEW.
 */
async function registrarAgendamento({
  telefone,
  nome,
  email,
  imovelCodigo,
  imovelDescricao,
  dataAgendamento,
}) {
  // Salva localmente primeiro (garantia)
  const localResult = await query(
    `INSERT INTO leads (phone_number, nome, email, imovel_codigo, imovel_descricao, data_agendamento, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'agendado')
     RETURNING id`,
    [telefone, nome, email, imovelCodigo, imovelDescricao, dataAgendamento]
  );

  const localId = localResult.rows[0].id;

  // Tenta sincronizar com IMOVIEW
  const lead = await criarLead({ nome, telefone, email, imovelCodigo });
  const agendamento = await criarAgendamento({
    leadId: lead.id,
    imovelCodigo,
    dataHora: dataAgendamento,
    clienteNome: nome,
  });

  // Atualiza IDs do IMOVIEW no banco local
  if (lead.id || agendamento.id) {
    await query(
      'UPDATE leads SET imoview_lead_id = $1, imoview_agendamento_id = $2 WHERE id = $3',
      [lead.id, agendamento.id, localId]
    );
  }

  logger.info('Agendamento registrado', {
    localId,
    imoviewLeadId: lead.id,
    imoviewAgendamentoId: agendamento.id,
    telefone,
    imovelCodigo,
  });

  return {
    sucesso: true,
    localId,
    imoviewLeadId: lead.id,
    imoviewAgendamentoId: agendamento.id,
  };
}

module.exports = { criarLead, criarAgendamento, registrarAgendamento };
