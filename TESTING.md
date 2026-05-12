# 🧪 Guia de Testes Locais

Teste o projeto localmente sem precisar de chaves reais do WhatsApp, OpenAI, etc.

---

## ⚡ Teste Rápido (5 minutos)

### 1. Subir apenas o banco de dados

```bash
# Iniciar PostgreSQL
docker-compose up -d postgres

# Aguardar 10 segundos
sleep 10

# Verificar se está saudável
docker-compose exec postgres pg_isready
```

Esperado: `accepting connections`

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar migrations

```bash
npm run migrate
```

Esperado: mensagens de sucesso das tabelas criadas

### 4. Iniciar servidor

```bash
npm run dev
```

Esperado:
```
[timestamp] info: Servidor iniciado na porta 3000
[timestamp] info: Conexão com PostgreSQL estabelecida com sucesso
```

### 5. Testar health check

Em **outro terminal**:
```bash
curl http://localhost:3000/health
```

Esperado:
```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "whatsapp": "not_configured",
    "openai": "not_configured"
  }
}
```

---

## 🧬 Testes de Integração (sem APIs externas)

### Teste 1: Banco de Dados

```bash
# Conectar ao banco
docker-compose exec postgres psql -U chatbot_user -d chatbot_imobiliaria

# Dentro do psql:
\dt                              # Ver tabelas criadas
SELECT * FROM migrations;        # Ver migrations executadas
SELECT COUNT(*) FROM conversations;  # Contar conversas (deve ser 0)
\q                               # Sair
```

### Teste 2: Modelo de Conversa

Crie um arquivo `test-conversation.js`:

```javascript
const conversationModel = require('./src/models/conversation');
const { testConnection } = require('./src/database/connection');

(async () => {
  await testConnection();
  
  console.log('🧪 Testando modelo de conversa...\n');

  // Teste 1: Criar ou buscar conversa
  const conv = await conversationModel.getOrCreate('5511999999999');
  console.log('✅ Conversa criada:', conv.phone_number);

  // Teste 2: Adicionar mensagem
  await conversationModel.addMessage('5511999999999', 'user', 'Olá, procuro um apartamento');
  console.log('✅ Mensagem do usuário adicionada');

  await conversationModel.addMessage('5511999999999', 'assistant', 'Olá! Bem-vindo!');
  console.log('✅ Resposta do assistente adicionada');

  // Teste 3: Recuperar mensagens
  const messages = await conversationModel.getMessages('5511999999999');
  console.log('✅ Mensagens recuperadas:', messages.length);

  // Teste 4: Atualizar estado
  await conversationModel.updateState('5511999999999', 'agendado');
  console.log('✅ Estado atualizado para agendado');

  // Teste 5: Atualizar info do cliente
  await conversationModel.updateClienteInfo('5511999999999', {
    nome: 'João Silva',
    email: 'joao@email.com'
  });
  console.log('✅ Informações do cliente atualizadas');

  console.log('\n✨ Todos os testes passaram!');
  process.exit(0);
})().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
```

Execute:
```bash
node test-conversation.js
```

### Teste 3: Serviço SR Proprietário (dados simulados)

Crie `test-imoveis.js`:

```javascript
const srProprietario = require('./src/services/srProprietario');

(async () => {
  console.log('🧪 Testando busca de imóveis (dados simulados)...\n');

  // Teste 1: Buscar sem filtros
  const todosImoveis = await srProprietario.buscarImoveis();
  console.log('✅ Buscou', todosImoveis.length, 'imóveis');

  // Teste 2: Buscar apartamentos para venda
  const apartamentos = await srProprietario.buscarImoveis({
    tipo: 'Apartamento',
    modalidade: 'venda'
  });
  console.log('✅ Encontrou', apartamentos.length, 'apartamento(s)');
  
  if (apartamentos.length > 0) {
    const ap = apartamentos[0];
    console.log('   -', ap.tipo, 'em', ap.bairro, '|', 'R$', ap.preco);
  }

  // Teste 3: Buscar por preço máximo
  const barato = await srProprietario.buscarImoveis({
    preco_max: 500000
  });
  console.log('✅ Encontrou', barato.length, 'imóvel(is) até R$ 500mil');

  // Teste 4: Obter detalhes de um imóvel
  const detalhes = await srProprietario.obterDetalhes('AP001');
  if (detalhes) {
    console.log('✅ Detalhes do AP001:', detalhes.metragem, 'm²,', detalhes.quartos, 'quartos');
  }

  console.log('\n✨ Testes de imóveis passaram!');
  process.exit(0);
})().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
```

Execute:
```bash
node test-imoveis.js
```

---

## 🌐 Testes de API (simulando WhatsApp)

### Teste com cURL

```bash
# 1. Verificar webhook (simula verificação do Meta)
curl -X GET "http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=meu_token_secreto_aqui"
```

Esperado: `test_challenge` (texto puro)

```bash
# 2. Enviar mensagem simulada (simula cliente WhatsApp)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.123456",
            "from": "5511999999999",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Olá, procuro um apartamento em Savassi"
            }
          }],
          "contacts": [{
            "profile": {
              "name": "João Silva"
            }
          }]
        }
      }]
    }]
  }'
```

Esperado: `{"status":"ok"}`

### Teste com Postman

1. **Abra Postman** e crie uma nova requisição
2. **GET** `http://localhost:3000/webhook`
3. **Params**:
   - `hub.mode` = `subscribe`
   - `hub.challenge` = `test_challenge`
   - `hub.verify_token` = valor do seu `.env` (WHATSAPP_VERIFY_TOKEN)
4. **Send**
5. Deve retornar `test_challenge`

---

## 🤖 Teste do GPT-4 com Mock

Se você tiver `OPENAI_API_KEY` configurada no `.env`, crie `test-gpt.js`:

```javascript
const { config } = require('./src/config');
const openaiService = require('./src/services/openai');

(async () => {
  if (!config.openai.apiKey) {
    console.log('⚠️  OPENAI_API_KEY não configurada. Pulando teste.');
    process.exit(0);
  }

  console.log('🧪 Testando GPT-4...\n');

  const messages = [
    {
      role: 'user',
      content: 'Olá, procuro um apartamento de 2 quartos em Belo Horizonte'
    }
  ];

  const toolHandlers = {
    buscar_imoveis: async (args) => {
      console.log('   → GPT chamou buscar_imoveis com:', args);
      return { imoveis: [], total: 0 };
    },
    obter_detalhes_imovel: async (args) => {
      console.log('   → GPT chamou obter_detalhes_imovel com:', args);
      return { imovel: null };
    },
    agendar_visita: async (args) => {
      console.log('   → GPT chamou agendar_visita com:', args);
      return { sucesso: true };
    },
    transferir_para_humano: async (args) => {
      console.log('   → GPT chamou transferir_para_humano');
      return { transferido: true };
    }
  };

  try {
    console.log('📨 Enviando mensagem para GPT-4...\n');
    const response = await openaiService.chat(messages, toolHandlers);
    
    console.log('✅ Resposta do GPT-4:');
    console.log(response.text);
    console.log('\n✨ Teste de GPT-4 passou!');
  } catch (err) {
    console.error('❌ Erro ao chamar GPT-4:', err.message);
  }

  process.exit(0);
})();
```

Execute:
```bash
OPENAI_API_KEY=sua_chave_real node test-gpt.js
```

---

## 📊 Teste Ponta-a-Ponta (E2E)

Crie `test-e2e.js` para simular um fluxo completo:

```javascript
const conversationModel = require('./src/models/conversation');
const srProprietario = require('./src/services/srProprietario');
const { testConnection } = require('./src/database/connection');

(async () => {
  await testConnection();

  console.log('🧪 Teste E2E: Fluxo de uma conversa\n');
  console.log('═'.repeat(50));

  const phoneNumber = '5511987654321';
  let conversaId = 1;

  // Etapa 1: Cliente manda primeira mensagem
  console.log('\n1️⃣  Cliente envia: "Procuro apartamento em Savassi"');
  let conv = await conversationModel.getOrCreate(phoneNumber);
  await conversationModel.addMessage(phoneNumber, 'user', 'Procuro apartamento em Savassi');
  await conversationModel.updateClienteInfo(phoneNumber, { nome: 'João Silva', email: null });
  console.log('   ✅ Conversa criada, mensagem salva');

  // Etapa 2: Simular resposta do assistente
  console.log('\n2️⃣  Assistente busca imóveis');
  const imoveis = await srProprietario.buscarImoveis({
    tipo: 'Apartamento',
    bairro: 'Savassi',
    modalidade: 'venda'
  });
  console.log(`   ✅ Encontrou ${imoveis.length} imóvel(is)`);

  // Etapa 3: Salvar resposta
  const resposta = imoveis.length > 0 
    ? `Encontrei ${imoveis.length} apartamento(s) em Savassi!`
    : 'Não encontrei apartamentos em Savassi.';
  await conversationModel.addMessage(phoneNumber, 'assistant', resposta);
  console.log('   ✅ Resposta salva');

  // Etapa 4: Cliente agendar visita
  console.log('\n3️⃣  Cliente agenda visita');
  if (imoveis.length > 0) {
    const imovel = imoveis[0];
    await conversationModel.addMessage(
      phoneNumber,
      'user',
      `Quero agendar visita para o ${imovel.tipo} de R$ ${imovel.preco}`
    );
    console.log('   ✅ Solicitação de agendamento registrada');
  }

  // Etapa 5: Histórico completo
  console.log('\n4️⃣  Histórico da conversa');
  const messages = await conversationModel.getMessages(phoneNumber);
  messages.forEach((msg, i) => {
    const role = msg.role === 'user' ? '👤' : '🤖';
    console.log(`   ${role} ${msg.content.substring(0, 50)}...`);
  });
  console.log(`   ✅ ${messages.length} mensagens no histórico`);

  // Etapa 6: Estado final
  await conversationModel.updateState(phoneNumber, 'agendado');
  conv = await conversationModel.getOrCreate(phoneNumber);
  console.log('\n5️⃣  Estado final da conversa:', conv.state);
  console.log('   ✅ Conversa marcada como agendada');

  console.log('\n' + '═'.repeat(50));
  console.log('✨ Teste E2E passou com sucesso!\n');
  process.exit(0);
})().catch(err => {
  console.error('❌ Erro no teste E2E:', err.message);
  process.exit(1);
});
```

Execute:
```bash
node test-e2e.js
```

---

## 📋 Checklist de Testes Locais

```bash
# 1. Setup
[ ] npm install
[ ] cp .env.example .env
[ ] docker-compose up -d postgres
[ ] npm run migrate
[ ] npm run dev

# 2. Validação
[ ] ./test-setup.sh
[ ] curl http://localhost:3000/health
[ ] node test-conversation.js
[ ] node test-imoveis.js
[ ] node test-e2e.js

# 3. API
[ ] Testar webhook GET (Postman ou curl)
[ ] Testar webhook POST (simular mensagem)
[ ] Verificar logs: docker-compose logs app

# 4. Banco de Dados
[ ] Conectar via psql
[ ] Verificar tabelas criadas
[ ] Verificar dados inseridos pelos testes
```

---

## 🎯 Cenários de Teste

### Cenário 1: Cliente busca imóvel
```
Cliente: "Procuro casa com 4 quartos em Buritis"
         ↓
GPT chama buscar_imoveis(tipo=Casa, quartos_min=4, bairro=Buritis)
         ↓
SR Proprietário retorna 1 casa (dados simulados)
         ↓
GPT descreve a casa e oferece agendamento
         ↓
Cliente: "Quero agendar uma visita"
         ↓
GPT chama agendar_visita()
         ↓
Lead criado no banco local + IMOVIEW (se configurado)
```

### Cenário 2: Cliente sem preferência clara
```
Cliente: "Olá"
         ↓
GPT faz perguntas para entender necessidades
         ↓
Cliente: "Alguma coisa em Funcionários, até R$ 400mil"
         ↓
GPT chama buscar_imoveis(preco_max=400000, bairro=Funcionários)
         ↓
Continua fluxo normal...
```

### Cenário 3: Cliente pede para falar com humano
```
Cliente: "Preciso falar com alguém de verdade"
         ↓
GPT chama transferir_para_humano()
         ↓
Conversa marcada como transferida
         ↓
Um corretor humano entra em contato
```

---

## 🔗 Variáveis de Teste

Se quiser testar com APIs reais, configure:

```bash
# Obter em: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Obter em: https://developers.facebook.com (seu App > Ferramentas)
# Use um número de teste do WhatsApp
WHATSAPP_ACCESS_TOKEN=EABC...
WHATSAPP_PHONE_NUMBER_ID=102...
WHATSAPP_VERIFY_TOKEN=seu_token_aqui
```

---

## 💡 Dicas de Desenvolvimento

```bash
# Hot reload (nodemon)
npm run dev

# Apenas compilar/validar sem rodar
node -c src/index.js

# Limpar logs
rm logs/*.log

# Resetar banco (cuidado! apaga tudo)
docker-compose down -v
docker-compose up -d postgres
npm run migrate
```

---

## ✅ Conclusão

Você pode testar **100% localmente** sem precisar de:
- Chaves do WhatsApp reais
- Chaves da OpenAI (para testes básicos)
- SR Proprietário ou IMOVIEW configurados

Todos os dados vêm de **simulações** que você pode ver nos arquivos de teste!

Comece pelo teste E2E → `node test-e2e.js` 🚀
