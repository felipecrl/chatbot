const logger = require('../utils/logger');

/**
 * Mock do OpenAI para testes locais SEM CUSTO
 * Simula respostas do GPT-4 sem chamar a API real
 */

async function chat(messages, toolHandlers) {
  logger.info('🧪 MODO TESTE: Usando respostas simuladas (sem chamar OpenAI)');

  // Extrair última mensagem do usuário
  const lastMessage = messages[messages.length - 1];
  const userText = lastMessage?.content?.toLowerCase() || '';

  let response = '';

  // Simular respostas baseadas em keywords
  if (userText.includes('apartamento') || userText.includes('imóvel')) {
    response = 'Ótimo! Procurando apartamento? 🏠\n\nVou buscar algumas opções para você. Qual é sua faixa de preço e localização preferida?';
  } else if (userText.includes('agendar') || userText.includes('visita')) {
    response = 'Perfeito! Vou agendar sua visita. Qual é seu nome completo e melhor horário para você?';
  } else if (userText.includes('obrigado') || userText.includes('valeu')) {
    response = 'De nada! 😊 Qualquer dúvida, é só chamar. Estou por aqui para ajudar!';
  } else if (userText.includes('oi') || userText.includes('olá')) {
    response = 'Olá! 👋 Bem-vindo ao nosso serviço de imobiliária!\n\nEu sou um assistente de IA. Como posso ajudá-lo hoje? Procura algum imóvel específico?';
  } else if (userText.includes('preço') || userText.includes('quanto custa')) {
    response = 'Temos opções em várias faixas de preço! 💰\n\nDesde apartamentos mais acessíveis até casarões de luxo. Qual sua faixa orçamentária?';
  } else {
    // Resposta padrão para qualquer outra coisa
    response = `Entendi sua mensagem: "${userText}"\n\nPosso ajudá-lo com:\n✅ Busca de imóveis\n✅ Agendamento de visitas\n✅ Informações sobre preços\n\nO que você procura?`;
  }

  logger.info('✅ Resposta simulada gerada', { response: response.substring(0, 80) });

  return {
    text: response,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, // Simular uso zero
  };
}

module.exports = { chat };
