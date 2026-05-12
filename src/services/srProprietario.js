const axios = require('axios');
const { config } = require('../config');
const logger = require('../utils/logger');

const api = axios.create({
  baseURL: config.srProprietario.apiUrl,
  headers: {
    Authorization: `Bearer ${config.srProprietario.apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Busca imóveis conforme critérios do cliente.
 * A estrutura exata dos parâmetros e resposta pode variar conforme
 * a versão da API do SR Proprietário — ajuste os campos abaixo conforme
 * a documentação fornecida pelo suporte.
 */
async function buscarImoveis(filtros = {}) {
  if (!config.srProprietario.apiKey) {
    logger.warn('SR Proprietário não configurado — retornando dados simulados');
    return dadosSimulados(filtros);
  }

  try {
    const params = {
      ...(filtros.modalidade && { finalidade: filtros.modalidade }),
      ...(filtros.tipo && { tipo: filtros.tipo }),
      ...(filtros.cidade && { cidade: filtros.cidade }),
      ...(filtros.bairro && { bairro: filtros.bairro }),
      ...(filtros.preco_min && { valor_min: filtros.preco_min }),
      ...(filtros.preco_max && { valor_max: filtros.preco_max }),
      ...(filtros.quartos_min && { quartos: filtros.quartos_min }),
      ...(filtros.metragem_min && { area_min: filtros.metragem_min }),
      limite: config.chatbot.maxImoveisPorResposta,
      status: 'disponivel',
    };

    const response = await api.get('/imoveis', { params });
    const imoveis = response.data.imoveis || response.data.data || response.data || [];

    return imoveis.slice(0, config.chatbot.maxImoveisPorResposta).map(normalizar);
  } catch (err) {
    logger.error('Erro ao buscar imóveis no SR Proprietário', {
      error: err.response?.data || err.message,
    });
    throw new Error('Não foi possível buscar imóveis no momento. Tente novamente em breve.');
  }
}

async function obterDetalhes(codigo) {
  if (!config.srProprietario.apiKey) {
    return dadosSimulados({ codigo })[0] || null;
  }

  try {
    const response = await api.get(`/imoveis/${codigo}`);
    return normalizar(response.data.imovel || response.data);
  } catch (err) {
    logger.error('Erro ao obter detalhes do imóvel', { codigo, error: err.message });
    throw new Error(`Não foi possível obter detalhes do imóvel ${codigo}.`);
  }
}

function normalizar(imovel) {
  return {
    codigo: imovel.codigo || imovel.id || imovel.referencia,
    tipo: imovel.tipo || imovel.categoria,
    modalidade: imovel.finalidade || imovel.modalidade || 'venda',
    cidade: imovel.cidade,
    bairro: imovel.bairro,
    endereco: imovel.endereco || imovel.logradouro,
    preco: parseFloat(imovel.valor || imovel.preco || 0),
    metragem: parseFloat(imovel.area || imovel.metragem || imovel.area_util || 0),
    quartos: parseInt(imovel.quartos || imovel.dormitorios || 0),
    banheiros: parseInt(imovel.banheiros || 0),
    vagas: parseInt(imovel.vagas || imovel.garagem || 0),
    amenidades: imovel.amenidades || imovel.caracteristicas || [],
    descricao: imovel.descricao || imovel.observacao || '',
    fotos: imovel.fotos || imovel.imagens || [],
  };
}

function dadosSimulados(filtros) {
  const base = [
    {
      codigo: 'AP001',
      tipo: 'Apartamento',
      modalidade: 'venda',
      cidade: config.chatbot.empresaCidade,
      bairro: 'Savassi',
      preco: 450000,
      metragem: 75,
      quartos: 2,
      banheiros: 2,
      vagas: 1,
      amenidades: ['Academia', 'Piscina', 'Portaria 24h'],
      descricao: 'Lindo apartamento em localização privilegiada.',
      fotos: [],
    },
    {
      codigo: 'CS002',
      tipo: 'Casa',
      modalidade: 'venda',
      cidade: config.chatbot.empresaCidade,
      bairro: 'Buritis',
      preco: 680000,
      metragem: 180,
      quartos: 4,
      banheiros: 3,
      vagas: 2,
      amenidades: ['Quintal', 'Churrasqueira', 'Piscina'],
      descricao: 'Casa espaçosa em condomínio fechado.',
      fotos: [],
    },
    {
      codigo: 'AP003',
      tipo: 'Apartamento',
      modalidade: 'aluguel',
      cidade: config.chatbot.empresaCidade,
      bairro: 'Funcionários',
      preco: 2800,
      metragem: 60,
      quartos: 2,
      banheiros: 1,
      vagas: 1,
      amenidades: ['Portaria 24h', 'Elevador'],
      descricao: 'Apartamento para alugar, próximo ao metrô.',
      fotos: [],
    },
  ];

  return base
    .filter((i) => !filtros.modalidade || i.modalidade === filtros.modalidade)
    .filter((i) => !filtros.preco_max || i.preco <= filtros.preco_max)
    .filter((i) => !filtros.quartos_min || i.quartos >= filtros.quartos_min)
    .slice(0, config.chatbot.maxImoveisPorResposta);
}

module.exports = { buscarImoveis, obterDetalhes };
