const conversationModel = require('./src/models/conversation');
const { testConnection } = require('./src/database/connection');
const logger = require('./src/utils/logger');

(async () => {
  try {
    await testConnection();

    logger.info('🧪 Testando modelo de conversa...\n');

    // Teste 1: Criar ou buscar conversa
    const phoneNumber = '5511999999999';
    const conv = await conversationModel.getOrCreate(phoneNumber);
    logger.info('✅ Conversa criada', { phone: conv.phone_number });

    // Teste 2: Adicionar mensagem do usuário
    await conversationModel.addMessage(phoneNumber, 'user', 'Olá, procuro um apartamento');
    logger.info('✅ Mensagem do usuário adicionada');

    // Teste 3: Adicionar resposta do assistente
    await conversationModel.addMessage(phoneNumber, 'assistant', 'Olá! Bem-vindo! 👋');
    logger.info('✅ Resposta do assistente adicionada');

    // Teste 4: Recuperar mensagens
    const messages = await conversationModel.getMessages(phoneNumber);
    logger.info('✅ Mensagens recuperadas', { count: messages.length });

    // Teste 5: Atualizar estado
    await conversationModel.updateState(phoneNumber, 'agendado');
    logger.info('✅ Estado atualizado para agendado');

    // Teste 6: Atualizar info do cliente
    await conversationModel.updateClienteInfo(phoneNumber, {
      nome: 'João Silva',
      email: 'joao@email.com',
    });
    logger.info('✅ Informações do cliente atualizadas');

    // Teste 7: Adicionar imóvel visto
    await conversationModel.addImovelVisto(phoneNumber, 'AP001');
    logger.info('✅ Imóvel visto registrado');

    logger.info('\n✨ Todos os testes de conversa passaram!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Erro no teste', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
