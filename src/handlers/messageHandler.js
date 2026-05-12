const conversationModel = require('../models/conversation');
const whatsappService = require('../services/whatsapp');
const srProprietarioService = require('../services/srProprietario');
const imoviewService = require('../services/imoview');
const { config } = require('../config');
const logger = require('../utils/logger');

const openaiService = config.server.useMockGPT
  ? require('../services/openai-mock')
  : require('../services/openai');

async function handleMessage({ messageId, from, text, contactName }) {
  logger.info('Mensagem recebida', { from, text: text.substring(0, 80) });

  await whatsappService.markAsRead(messageId);

  const conversation = await conversationModel.getOrCreate(from);

  if (conversation.state === 'transferido') {
    logger.info('Conversa transferida para humano — ignorando mensagem', { from });
    return;
  }

  if (conversation.state === 'encerrada') {
    await conversationModel.updateState(from, 'active');
    await conversationModel.updateClienteInfo(from, {
      nome: contactName || null,
      email: null,
    });
  }

  await conversationModel.addMessage(from, 'user', text);

  const messages = await conversationModel.getMessages(from);
  const historyForGPT = messages.slice(-20); // últimas 20 mensagens como contexto

  const toolHandlers = {
    buscar_imoveis: async (args) => {
      try {
        const imoveis = await srProprietarioService.buscarImoveis(args);
        if (imoveis.length === 0) {
          return { mensagem: 'Nenhum imóvel encontrado com esses critérios.', imoveis: [] };
        }

        // Envia as fotos dos imóveis via WhatsApp em paralelo com a resposta do GPT
        setImmediate(async () => {
          try {
            await whatsappService.sendMultiplosImoveis(from, imoveis);
          } catch (err) {
            logger.error('Erro ao enviar fotos dos imóveis', { error: err.message });
          }
        });

        // Registra imóveis vistos
        for (const imovel of imoveis) {
          await conversationModel.addImovelVisto(from, imovel.codigo);
        }

        return { imoveis, total: imoveis.length };
      } catch (err) {
        logger.error('Erro na busca de imóveis', { error: err.message });
        return { erro: err.message, imoveis: [] };
      }
    },

    obter_detalhes_imovel: async ({ codigo }) => {
      try {
        const imovel = await srProprietarioService.obterDetalhes(codigo);
        if (!imovel) return { erro: 'Imóvel não encontrado' };
        return { imovel };
      } catch (err) {
        return { erro: err.message };
      }
    },

    agendar_visita: async (args) => {
      const { imovel_codigo, cliente_nome, cliente_telefone, cliente_email, data_preferida } = args;

      try {
        // Atualiza informações do cliente na conversa
        await conversationModel.updateClienteInfo(from, {
          nome: cliente_nome,
          email: cliente_email,
        });

        let dataAgendamento = null;
        if (data_preferida) {
          dataAgendamento = parseDataBrasileira(data_preferida);
        }

        const resultado = await imoviewService.registrarAgendamento({
          telefone: cliente_telefone || from,
          nome: cliente_nome,
          email: cliente_email,
          imovelCodigo: imovel_codigo,
          imovelDescricao: `Imóvel ${imovel_codigo}`,
          dataAgendamento,
        });

        await conversationModel.updateState(from, 'agendado');

        logger.info('Visita agendada com sucesso', { from, imovel_codigo, cliente_nome });

        return {
          sucesso: true,
          mensagem: `Visita agendada com sucesso para ${cliente_nome} ao imóvel ${imovel_codigo}${data_preferida ? ` em ${data_preferida}` : ''}. Nossa equipe entrará em contato para confirmar.`,
          agendamento_id: resultado.localId,
        };
      } catch (err) {
        logger.error('Erro ao agendar visita', { error: err.message });
        return {
          sucesso: false,
          erro: 'Não foi possível agendar a visita automaticamente. Nossa equipe entrará em contato.',
        };
      }
    },

    transferir_para_humano: async ({ motivo }) => {
      await conversationModel.updateState(from, 'transferido');
      logger.info('Conversa transferida para humano', { from, motivo });
      return {
        transferido: true,
        mensagem: 'Conversa marcada para atendimento humano. Um corretor entrará em contato em breve.',
      };
    },
  };

  try {
    const gptResponse = await openaiService.chat(historyForGPT, toolHandlers);

    if (gptResponse.text) {
      await conversationModel.addMessage(from, 'assistant', gptResponse.text);
      if (!config.server.skipWhatsappSend) {
        await whatsappService.sendText(from, gptResponse.text);
      } else {
        logger.info('✅ Resposta (não enviada ao WhatsApp em modo teste)', { text: gptResponse.text.substring(0, 100) });
      }
    }

    logger.debug('Uso de tokens', gptResponse.usage);
  } catch (err) {
    logger.error('Erro ao processar mensagem com GPT-4', { from, error: err.message });
    if (!config.server.skipWhatsappSend) {
      await whatsappService.sendText(
        from,
        'Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente?'
      );
    }
  }
}

function parseDataBrasileira(str) {
  // Converte "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY" para Date
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, d, m, y, h = '10', min = '00'] = match;
  return new Date(`${y}-${m}-${d}T${h}:${min}:00`);
}

module.exports = { handleMessage };
