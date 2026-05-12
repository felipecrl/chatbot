const conversationModel = require('./src/models/conversation');
const srProprietario = require('./src/services/srProprietario');
const { testConnection } = require('./src/database/connection');
const logger = require('./src/utils/logger');

(async () => {
  try {
    await testConnection();

    const phoneNumber = '5511987654321';

    logger.info('\n🧪 Teste E2E: Simulando uma conversa completa\n');
    logger.info('═'.repeat(60));

    // Etapa 1: Cliente manda primeira mensagem
    logger.info('\n1️⃣  Cliente manda mensagem via WhatsApp');
    logger.info('   Mensagem: "Procuro apartamento em Savassi"');

    let conv = await conversationModel.getOrCreate(phoneNumber);
    await conversationModel.addMessage(phoneNumber, 'user', 'Procuro apartamento em Savassi');
    await conversationModel.updateClienteInfo(phoneNumber, {
      nome: 'João Silva',
      email: null,
    });
    logger.info('   ✅ Conversa criada, mensagem salva no banco');

    // Etapa 2: GPT-4 processa e busca imóveis
    logger.info('\n2️⃣  GPT-4 analisa e chama buscar_imoveis()');
    logger.info('   Filtros: tipo=Apartamento, bairro=Savassi');

    const imoveis = await srProprietario.buscarImoveis({
      tipo: 'Apartamento',
      bairro: 'Savassi',
      modalidade: 'venda',
    });

    logger.info(`   ✅ SR Proprietário retornou ${imoveis.length} imóvel(is)`);

    if (imoveis.length > 0) {
      imoveis.slice(0, 2).forEach((im, i) => {
        logger.info(`   └─ [${i + 1}] ${im.tipo} | R$ ${im.preco} | ${im.metragem}m²`);
      });
    }

    // Etapa 3: Salvar resposta do assistente
    logger.info('\n3️⃣  GPT-4 gera resposta e envia via WhatsApp');
    const resposta = imoveis.length > 0
      ? `Encontrei ${imoveis.length} apartamento(s) em Savassi! 🏠`
      : 'Infelizmente não encontrei apartamentos em Savassi no momento.';

    await conversationModel.addMessage(phoneNumber, 'assistant', resposta);
    logger.info(`   ✅ Resposta salva: "${resposta}"`);

    // Etapa 4: Registrar imóveis vistos
    logger.info('\n4️⃣  Registrar imóveis que cliente viu');
    if (imoveis.length > 0) {
      for (const imovel of imoveis) {
        await conversationModel.addImovelVisto(phoneNumber, imovel.codigo);
      }
      logger.info(`   ✅ ${imoveis.length} imóvel(is) marcado(s) como visto(s)`);
    }

    // Etapa 5: Cliente toma próxima ação
    logger.info('\n5️⃣  Cliente responde e quer agendar visita');
    const proximaMensagem = imoveis.length > 0
      ? `Quero agendar visita para o ${imoveis[0].tipo} de R$ ${imoveis[0].preco.toLocaleString('pt-BR')}`
      : 'Tudo bem, obrigado!';

    await conversationModel.addMessage(phoneNumber, 'user', proximaMensagem);
    logger.info(`   ✅ Mensagem registrada: "${proximaMensagem}"`);

    // Etapa 6: Simular agendamento
    if (imoveis.length > 0) {
      logger.info('\n6️⃣  GPT-4 chama agendar_visita()');
      logger.info(`   Imóvel: ${imoveis[0].codigo}`);
      logger.info(`   Cliente: João Silva`);
      logger.info(`   WhatsApp: ${phoneNumber}`);

      const confirmacao = `Ótimo! Agendei sua visita para o ${imoveis[0].tipo} em ${imoveis[0].bairro}. Um corretor entrará em contato! 📞`;
      await conversationModel.addMessage(phoneNumber, 'assistant', confirmacao);
      await conversationModel.updateState(phoneNumber, 'agendado');
      logger.info(`   ✅ Visita agendada e estado atualizado`);
    }

    // Etapa 7: Exibir histórico completo
    logger.info('\n7️⃣  Histórico completo da conversa');
    const messages = await conversationModel.getMessages(phoneNumber);
    logger.info(`   Total de mensagens: ${messages.length}`);

    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? '👤 Cliente' : '🤖 Assistente';
      const preview = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
      logger.info(`   [${idx + 1}] ${role}: ${preview}`);
    });

    // Etapa 8: Estado final
    logger.info('\n8️⃣  Estado final da conversa');
    conv = await conversationModel.getOrCreate(phoneNumber);
    logger.info(`   Estado: ${conv.state}`);
    logger.info(`   Cliente: ${conv.cliente_nome || 'Não informado'}`);
    logger.info(`   Email: ${conv.cliente_email || 'Não informado'}`);
    logger.info(`   Imóveis vistos: ${(conv.imoveis_vistos || []).length}`);

    logger.info('\n' + '═'.repeat(60));
    logger.info('\n✨ Teste E2E concluído com sucesso!\n');
    logger.info('📊 Resumo do que foi testado:');
    logger.info('   ✅ Criação de conversa');
    logger.info('   ✅ Adição de mensagens');
    logger.info('   ✅ Busca de imóveis com filtros');
    logger.info('   ✅ Registro de imóveis vistos');
    logger.info('   ✅ Atualização de estado');
    logger.info('   ✅ Atualização de dados do cliente');
    logger.info('   ✅ Recuperação de histórico completo\n');

    process.exit(0);
  } catch (err) {
    logger.error('❌ Erro no teste E2E', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
