const OpenAI = require('openai');
const { config } = require('../config');
const logger = require('../utils/logger');

const client = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `Você é um corretor de imóveis experiente, amigável e persuasivo chamado Diego.
Você trabalha para a ${config.chatbot.empresaNome} em ${config.chatbot.empresaCidade}.

Seus objetivos (em ordem de prioridade):
1. Entender o que o cliente está procurando (orçamento, localização, tipo de imóvel)
2. Buscar imóveis que combinam com as necessidades do cliente
3. Descrever os imóveis com entusiasmo e destacar os pontos positivos
4. Convencer o cliente a agendar uma visita

Regras importantes:
- Converse sempre em português, com tom natural, caloroso e descontraído
- Faça perguntas uma por vez e aguarde a resposta antes de continuar
- Nunca ofereça mais de ${config.chatbot.maxImoveisPorResposta} imóveis por vez
- Use as informações dos imóveis (preço, quartos, localização, amenidades) para vender
- Se o cliente hesitar, ofereça alternativas, mais detalhes ou destaque benefícios
- Quando perceber interesse, peça o agendamento: "Posso marcar uma visita para você?"
- Ao agendar, colete: nome completo, e-mail e horário preferido
- Se o cliente pedir para falar com um corretor humano, confirme e transfira respeitosamente
- Nunca invente informações sobre imóveis — use apenas dados das ferramentas disponíveis
- Ao se apresentar, diga apenas que é um assistente da imobiliária, não mencione que é IA

Ao buscar imóveis, use a ferramenta buscar_imoveis.
Ao agendar visitas, use a ferramenta agendar_visita.
Para mais detalhes de um imóvel específico, use obter_detalhes_imovel.
Se o cliente quiser falar com humano, use transferir_para_humano.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_imoveis',
      description: 'Busca imóveis disponíveis com base nos critérios do cliente',
      parameters: {
        type: 'object',
        properties: {
          modalidade: {
            type: 'string',
            enum: ['venda', 'aluguel'],
            description: 'Se o cliente quer comprar ou alugar',
          },
          tipo: {
            type: 'string',
            description: 'Tipo do imóvel: apartamento, casa, comercial, terreno, etc.',
          },
          cidade: {
            type: 'string',
            description: 'Cidade onde o cliente quer o imóvel',
          },
          bairro: {
            type: 'string',
            description: 'Bairro específico, se mencionado',
          },
          preco_min: {
            type: 'number',
            description: 'Preço mínimo em reais',
          },
          preco_max: {
            type: 'number',
            description: 'Preço máximo em reais',
          },
          quartos_min: {
            type: 'integer',
            description: 'Número mínimo de quartos',
          },
          metragem_min: {
            type: 'number',
            description: 'Metragem mínima em m²',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_detalhes_imovel',
      description: 'Obtém informações detalhadas de um imóvel específico pelo código',
      parameters: {
        type: 'object',
        properties: {
          codigo: {
            type: 'string',
            description: 'Código do imóvel',
          },
        },
        required: ['codigo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_visita',
      description: 'Agenda uma visita a um imóvel e registra o lead no CRM',
      parameters: {
        type: 'object',
        properties: {
          imovel_codigo: {
            type: 'string',
            description: 'Código do imóvel a ser visitado',
          },
          cliente_nome: {
            type: 'string',
            description: 'Nome completo do cliente',
          },
          cliente_telefone: {
            type: 'string',
            description: 'Número de WhatsApp do cliente (com DDD)',
          },
          cliente_email: {
            type: 'string',
            description: 'E-mail do cliente',
          },
          data_preferida: {
            type: 'string',
            description: 'Data e hora preferida para a visita (formato: DD/MM/YYYY HH:MM)',
          },
        },
        required: ['imovel_codigo', 'cliente_nome', 'cliente_telefone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_para_humano',
      description: 'Transfere o atendimento para um corretor humano',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            description: 'Motivo da transferência',
          },
        },
        required: ['motivo'],
      },
    },
  },
];

async function chat(messages, toolHandlers) {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  let response = await client.chat.completions.create({
    model: config.openai.model,
    messages: formattedMessages,
    tools: TOOLS,
    tool_choice: 'auto',
    max_tokens: 1000,
    temperature: 0.7,
  });

  let assistantMessage = response.choices[0].message;

  // Processa chamadas de ferramentas em loop até o modelo retornar resposta final
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    formattedMessages.push(assistantMessage);

    const toolResults = [];
    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      logger.info(`GPT-4 chamou ferramenta: ${toolCall.function.name}`, { args });

      let result;
      const handler = toolHandlers[toolCall.function.name];
      if (handler) {
        result = await handler(args);
      } else {
        result = { erro: `Ferramenta ${toolCall.function.name} não implementada` };
      }

      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(result),
      });
    }

    formattedMessages.push(...toolResults);

    response = await client.chat.completions.create({
      model: config.openai.model,
      messages: formattedMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1000,
      temperature: 0.7,
    });

    assistantMessage = response.choices[0].message;
  }

  return {
    text: assistantMessage.content,
    usage: response.usage,
  };
}

module.exports = { chat };
