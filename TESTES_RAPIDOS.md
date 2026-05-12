# 🚀 Testes Rápidos - Execute Agora!

Teste o projeto **100% localmente** em 5 minutos. Sem precisar de chaves reais!

---

## ⚡ 1. Setup Inicial (primeira vez)

```bash
# Subir apenas o banco de dados
docker-compose up -d postgres

# Aguardar 10 segundos
sleep 10

# Instalar dependências
npm install

# Rodar migrations
npm run migrate
```

---

## 🧪 2. Executar Todos os Testes

```bash
./run-tests.sh
```

Isso vai executar:
1. ✅ **Teste de Conversa** — CRUD no PostgreSQL
2. ✅ **Teste de Imóveis** — Busca com filtros (dados simulados)
3. ✅ **Teste E2E** — Fluxo completo (cliente → busca → agendamento)

**Esperado:** Todos os testes **passam ✅**

---

## 🔧 Ou Executar Testes Individuais

### Teste 1: Conversa
```bash
node test-conversation.js
```
Testa: criar conversa, adicionar mensagens, atualizar estado, etc.

### Teste 2: Imóveis
```bash
node test-imoveis.js
```
Testa: busca com filtros, detalhes de imóvel, dados simulados

### Teste 3: E2E Completo
```bash
node test-e2e.js
```
Testa: fluxo inteiro (como se fosse um cliente de verdade)

---

## 📱 3. Testar API (simular WhatsApp)

Em um terminal, inicie o servidor:
```bash
npm run dev
```

Em outro terminal, teste o webhook:

### Verificação do webhook
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=meu_token_secreto_aqui"
```

**Esperado:** retorna `test_challenge`

### Simular mensagem de cliente
```bash
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
              "body": "Procuro um apartamento em Savassi"
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

**Esperado:** retorna `{"status":"ok"}` e vê logs da mensagem

### Health check
```bash
curl http://localhost:3000/health | jq .
```

**Esperado:**
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

## 📊 4. Inspecionar Banco de Dados

```bash
# Conectar ao PostgreSQL
docker-compose exec postgres psql -U chatbot_user -d chatbot_imobiliaria

# Dentro do psql:
SELECT * FROM conversations;        # Ver conversas criadas pelos testes
SELECT * FROM leads;                # Ver leads
SELECT * FROM migrations;           # Ver migrations executadas
\dt                                 # Listar todas as tabelas

# Sair
\q
```

---

## 📈 5. Ver Logs

```bash
# Logs em tempo real (se rodando npm run dev)
# Veja no terminal onde npm run dev está rodando

# Ou ver arquivo de log
tail -f logs/combined.log

# Ver apenas erros
tail -f logs/error.log
```

---

## ✅ Checklist de Testes Completo

- [ ] `docker-compose up -d postgres` (banco rodando)
- [ ] `npm install` (dependências instaladas)
- [ ] `npm run migrate` (banco criado)
- [ ] `./test-setup.sh` (validação do setup)
- [ ] `./run-tests.sh` (todos os testes passam)
- [ ] `npm run dev` + `curl localhost:3000/health` (servidor respondendo)
- [ ] Webhook GET funciona (retorna challenge)
- [ ] Webhook POST funciona (retorna ok)
- [ ] Banco de dados tem dados dos testes

---

## 🎯 O que cada teste valida

### `test-conversation.js`
```
✅ Criar conversa
✅ Adicionar mensagem de usuário
✅ Adicionar resposta do assistente
✅ Recuperar histórico
✅ Atualizar estado (ativo → agendado)
✅ Atualizar dados do cliente
✅ Registrar imóvel visto
```

### `test-imoveis.js`
```
✅ Buscar todos os imóveis
✅ Buscar com filtro de tipo (Apartamento, Casa)
✅ Buscar com filtro de modalidade (venda, aluguel)
✅ Buscar com filtro de preço máximo
✅ Obter detalhes de imóvel específico
✅ Simular resposta de SR Proprietário
```

### `test-e2e.js`
```
✅ Cliente envia mensagem
✅ Sistema cria conversa
✅ GPT-4 "decide" buscar imóveis
✅ Imóveis são buscados (simulados)
✅ Resposta salva no banco
✅ Imóveis marcados como vistos
✅ Cliente responde com interesse
✅ Sistema marca conversa como agendada
✅ Histórico completo recuperado
```

---

## 🐛 Se Algo Der Errado

### "Cannot connect to database"
```bash
docker-compose restart postgres
sleep 10
npm run migrate
```

### "Port 3000 already in use"
```bash
# Mude em docker-compose.yml ou use outra porta
PORT=3001 npm run dev
```

### "EADDRINUSE: address already in use"
```bash
# Mate o processo anterior
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
npm run dev
```

### Limpar logs
```bash
rm logs/*.log
```

### Resetar banco (cuidado!)
```bash
docker-compose down -v
docker-compose up -d postgres
npm run migrate
```

---

## 💡 Exemplo de Output Esperado

Ao rodar `./run-tests.sh`:

```
🧪 Executando suite de testes locais...

═════════════════════════════════════════════════════════════

1️⃣  Verificando PostgreSQL...
✅ PostgreSQL está rodando

2️⃣  Rodando migrations...
✅ Migrations executadas

3️⃣  Teste 1: Modelo de Conversa
   Testando CRUD de conversas no PostgreSQL...
[timestamp] info: 🧪 Testando modelo de conversa...
[timestamp] info: ✅ Conversa criada
[timestamp] info: ✅ Mensagem do usuário adicionada
[timestamp] info: ✅ Resposta do assistente adicionada
[timestamp] info: ✅ Mensagens recuperadas
[timestamp] info: ✅ Estado atualizado para agendado
[timestamp] info: ✅ Informações do cliente atualizadas
[timestamp] info: ✅ Imóvel visto registrado
[timestamp] info: ✨ Todos os testes de conversa passaram!

4️⃣  Teste 2: Busca de Imóveis
   Testando dados simulados de imóveis...
[timestamp] info: 🧪 Testando busca de imóveis (dados simulados)...
[timestamp] info: ✅ Buscou 3 imóveis totais
[timestamp] info: ✅ Encontrou 2 apartamento(s) para venda
[timestamp] info: ✅ Encontrou 1 casa(s) para venda
[timestamp] info: ✅ Encontrou 2 imóvel(is) até R$ 500.000
[timestamp] info: ✅ Encontrou 1 apartamento(s) para aluguel
[timestamp] info: ✅ Detalhes do imóvel AP001:
[timestamp] info: ✅ Corretamente retorna null para imóvel inexistente
[timestamp] info: ✨ Todos os testes de imóveis passaram!

5️⃣  Teste 3: Fluxo Ponta-a-Ponta (E2E)
   Simulando conversa completa com cliente...
[timestamp] info: 🧪 Teste E2E: Simulando uma conversa completa
[timestamp] info: 1️⃣  Cliente manda mensagem via WhatsApp
[timestamp] info:    Mensagem: "Procuro apartamento em Savassi"
[timestamp] info:    ✅ Conversa criada, mensagem salva no banco
[timestamp] info: 2️⃣  GPT-4 analisa e chama buscar_imoveis()
[timestamp] info:    ✅ SR Proprietário retornou 2 imóvel(is)
[timestamp] info: 3️⃣  GPT-4 gera resposta e envia via WhatsApp
[timestamp] info:    ✅ Resposta salva: "Encontrei 2 apartamento(s) em Savassi! 🏠"
[timestamp] info: ✨ Teste E2E concluído com sucesso!

═════════════════════════════════════════════════════════════

✨ Todos os testes passaram com sucesso!

📊 Resultados:
   ✅ Banco de dados funcionando
   ✅ Modelo de conversas operacional
   ✅ Busca de imóveis funcionando
   ✅ Fluxo E2E completo
```

---

## 🎓 Próximos Passos Depois dos Testes

1. **Configurar chaves reais** no `.env`:
   ```bash
   cp .env.example .env
   nano .env
   # Preencha: WHATSAPP_ACCESS_TOKEN, OPENAI_API_KEY, etc.
   ```

2. **Configurar webhook** no Meta for Developers:
   - URL: `https://seu-dominio.com/webhook`
   - Token: mesmo de `WHATSAPP_VERIFY_TOKEN`

3. **Testar com WhatsApp real**:
   - Envie mensagem para o número do seu chatbot
   - Veja resposta em tempo real
   - Acompanhe logs: `docker-compose logs -f app`

4. **Monitorar** em produção:
   - Health check: `curl https://seu-dominio.com/health`
   - Logs: `docker-compose logs -f`
   - Banco: conecte-se via pgAdmin

---

Dúvidas? Veja [TESTING.md](TESTING.md) para o guia completo!

🚀 **Comece agora:** `./run-tests.sh`
