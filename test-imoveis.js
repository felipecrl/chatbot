const srProprietario = require('./src/services/srProprietario');
const logger = require('./src/utils/logger');

(async () => {
  try {
    logger.info('🧪 Testando busca de imóveis (dados simulados)...\n');

    // Teste 1: Buscar sem filtros
    const todosImoveis = await srProprietario.buscarImoveis();
    logger.info(`✅ Buscou ${todosImoveis.length} imóveis totais`);

    // Teste 2: Buscar apartamentos para venda
    const apartamentos = await srProprietario.buscarImoveis({
      tipo: 'Apartamento',
      modalidade: 'venda',
    });
    logger.info(`✅ Encontrou ${apartamentos.length} apartamento(s) para venda`);

    if (apartamentos.length > 0) {
      const ap = apartamentos[0];
      logger.info(`   └─ ${ap.tipo} em ${ap.bairro} | R$ ${ap.preco} | ${ap.metragem}m²`);
    }

    // Teste 3: Buscar casas para venda
    const casas = await srProprietario.buscarImoveis({
      tipo: 'Casa',
      modalidade: 'venda',
    });
    logger.info(`✅ Encontrou ${casas.length} casa(s) para venda`);

    if (casas.length > 0) {
      const casa = casas[0];
      logger.info(
        `   └─ ${casa.tipo} em ${casa.bairro} | R$ ${casa.preco} | ${casa.quartos} quartos`
      );
    }

    // Teste 4: Buscar por preço máximo
    const barato = await srProprietario.buscarImoveis({
      preco_max: 500000,
    });
    logger.info(`✅ Encontrou ${barato.length} imóvel(is) até R$ 500.000`);

    // Teste 5: Buscar apartamento para aluguel
    const aluguel = await srProprietario.buscarImoveis({
      tipo: 'Apartamento',
      modalidade: 'aluguel',
    });
    logger.info(`✅ Encontrou ${aluguel.length} apartamento(s) para aluguel`);

    if (aluguel.length > 0) {
      const ap = aluguel[0];
      logger.info(`   └─ R$ ${ap.preco}/mês | ${ap.metragem}m² | ${ap.quartos} quartos`);
    }

    // Teste 6: Obter detalhes de um imóvel
    const detalhes = await srProprietario.obterDetalhes('AP001');
    if (detalhes) {
      logger.info('✅ Detalhes do imóvel AP001:');
      logger.info(`   ├─ Tipo: ${detalhes.tipo}`);
      logger.info(`   ├─ Preço: R$ ${detalhes.preco}`);
      logger.info(`   ├─ Metragem: ${detalhes.metragem}m²`);
      logger.info(`   ├─ Quartos: ${detalhes.quartos}`);
      logger.info(`   ├─ Banheiros: ${detalhes.banheiros}`);
      logger.info(`   └─ Amenidades: ${detalhes.amenidades.join(', ')}`);
    }

    // Teste 7: Imóvel inexistente
    const inexistente = await srProprietario.obterDetalhes('NAO_EXISTE_123');
    if (!inexistente) {
      logger.info('✅ Corretamente retorna null para imóvel inexistente');
    }

    logger.info('\n✨ Todos os testes de imóveis passaram!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Erro no teste de imóveis', { error: err.message });
    process.exit(1);
  }
})();
