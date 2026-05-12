# 🏠 Chatbot WhatsApp para Imobiliárias

Solução completa de automação com IA para WhatsApp. Integra **GPT-4** (conversas humanizadas), **SR Proprietário** (busca de imóveis), **IMOVIEW CRM** (gestão de leads) e **Meta Cloud API** (WhatsApp Business).

**Tecnologia:** Node.js + Express + PostgreSQL + OpenAI

---

## 📚 Guias Disponíveis

- **[QUICKSTART.md](QUICKSTART.md)** ⚡ — 5 passos para começar em 2 minutos
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** 🐳 — Guia detalhado: Docker, PostgreSQL, troubleshooting
- **Este arquivo (README.md)** — Documentação completa do projeto

👉 **Novo no projeto?** Comece pelo [QUICKSTART.md](QUICKSTART.md)

---

## 🚀 Início Rápido (3 minutos)

### 1. Validar ambiente
```bash
./test-setup.sh
```

### 2. Configurar variáveis
```bash
cp .env.example .env
nano .env
# Preencha: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, OPENAI_API_KEY
```

### 3. Subir tudo
```bash
docker-compose up -d
curl http://localhost:3000/health
```

✅ Pronto! Aplicação em `http://localhost:3000`

---

## 📋 Pré-requisitos

### Com Docker (Recomendado)
- Docker 20.10+
- Docker Compose v2.0+ (ou `docker compose`)

### Sem Docker (Desenvolvimento Local)
- Node.js 20+
- PostgreSQL 16+

---

## 🐳 Desenvolvimento com Docker

### Configuração de variáveis

Use o **único** arquivo `.env.example`:
```bash
cp .env.example .env
```

O arquivo já vem pronto com valores padrão e comentários explicativos.

### Iniciar

```bash
# Subir PostgreSQL + Node.js em background
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f app

# Parar quando quiser
docker-compose down
```

### Verificar Status

```bash
# Saúde da aplicação
curl http://localhost:3000/health

# Ver containers
docker-compose ps

# Conectar ao banco
docker-compose exec postgres psql -U chatbot_user -d chatbot_imobiliaria
```

Para troubleshooting, veja [DOCKER_SETUP.md](DOCKER_SETUP.md).

---

## 🛠️ Desenvolvimento Local (sem Docker)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar .env

```bash
cp .env.example .env
```

Edite e ajuste a variável de banco:
```env
DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/chatbot_imobiliaria
```

### 3. Criar banco de dados

```bash
# Ubuntu/Debian
createdb chatbot_imobiliaria

# Ou manualmente
psql
CREATE DATABASE chatbot_imobiliaria;
```

### 4. Rodar migrations

```bash
npm run migrate
```

### 5. Iniciar servidor

```bash
npm run dev    # Desenvolvimento (com reload)
npm start      # Produção
```

Acesse `http://localhost:3000`

---

## 🔧 Configuração do WhatsApp Webhook

Após ter a aplicação rodando, configure o webhook no Meta:

1. Acesse [Meta for Developers](https://developers.facebook.com)
2. Vá em **seu App > WhatsApp > Configuração > Webhook**
3. Configure:
   - **Callback URL**: `https://seu-dominio.com/webhook`
   - **Verify Token**: mesmo valor de `WHATSAPP_VERIFY_TOKEN` em `.env`
   - **Objetos Inscritos**: marque **messages**
4. Salve

Quando um cliente enviar mensagem no WhatsApp, será acionado o endpoint `POST /webhook`.

---

## 📁 Estrutura do Projeto

```
whatsapp-chatbot-imobiliaria/
├── src/
│   ├── index.js                    # Entry point
│   ├── config/
│   │   └── index.js                # Configurações centralizadas
│   ├── database/
│   │   ├── connection.js           # Pool PostgreSQL
│   │   └── migrations.js           # Cria tabelas
│   ├── models/
│   │   └── conversation.js         # Modelo de conversa
│   ├── services/
│   │   ├── whatsapp.js             # Meta Cloud API (envio)
│   │   ├── openai.js               # GPT-4 com function calling
│   │   ├── srProprietario.js       # API de busca de imóveis
│   │   └── imoview.js              # API CRM (leads + agendamentos)
│   ├── handlers/
│   │   └── messageHandler.js       # Orquestra fluxo de mensagem
│   ├── routes/
│   │   ├── webhook.js              # GET/POST /webhook
│   │   └── health.js               # GET /health
│   └── utils/
│       └── logger.js               # Winston (logs)
├── docker-compose.yml              # PostgreSQL + Node.js
├── Dockerfile                      # Imagem da aplicação
├── package.json                    # Dependências
├── .env.example                    # Template de variáveis
├── QUICKSTART.md                   # Guia rápido
├── DOCKER_SETUP.md                 # Guia detalhado Docker
└── test-setup.sh                   # Script de validação
```

---

## 📊 Fluxo Completo de uma Mensagem

```
Cliente envia mensagem no WhatsApp
         ↓
Meta Cloud API → POST /webhook
         ↓
messageHandler.js extrai dados (telefone, texto)
         ↓
Busca/cria conversa no PostgreSQL
         ↓
Envia histórico de mensagens para GPT-4
         ↓
GPT-4 escolhe ação:
  ├─ Resposta simples → sendText()
  ├─ buscar_imoveis() → SR Proprietário API → sendMultiplosImoveis()
  ├─ agendar_visita() → IMOVIEW CRM + lead no banco
  └─ transferir_para_humano() → marca conversa como transferida
         ↓
Resposta volta ao cliente via WhatsApp
         ↓
Histórico salvo em PostgreSQL para contexto futuro
```

---

## 🔌 Integrações

### 1️⃣ Meta Cloud API (WhatsApp)
- **Função**: Receber e enviar mensagens
- **Endpoint**: `POST /webhook`
- **Variavelsobrigatórias**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
- **Status**: ✅ Implementado e pronto

### 2️⃣ OpenAI GPT-4
- **Função**: Conversas humanizadas com function calling
- **Modelos**: gpt-4o (recomendado), gpt-4
- **Ferramentas disponíveis**:
  - `buscar_imoveis` — busca filtrada em SR Proprietário
  - `obter_detalhes_imovel` — detalhes de um imóvel
  - `agendar_visita` — cria lead + agendamento
  - `transferir_para_humano` — marca para atendimento humano
- **Variáveis obrigatórias**: `OPENAI_API_KEY`, `OPENAI_MODEL`
- **Status**: ✅ Implementado

### 3️⃣ SR Proprietário
- **Função**: Buscar imóveis cadastrados
- **Dados sincronizados**: código, tipo, preço, metragem, quartos, fotos, amenidades
- **Variáveis**: `SR_PROPRIETARIO_API_URL`, `SR_PROPRIETARIO_API_KEY`
- **Status**: ✅ Implementado com dados simulados se API não estiver configurada

### 4️⃣ IMOVIEW CRM
- **Função**: Registrar leads e agendamentos
- **Dados enviados**: nome, telefone, email, imóvel, data/hora da visita
- **Variáveis**: `IMOVIEW_API_URL`, `IMOVIEW_API_KEY`, `IMOVIEW_EMPRESA_ID`
- **Status**: ✅ Implementado com fallback para banco local

---

## 📦 Stack Tecnológico

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| **Mensageria** | Meta Cloud API | Principal canal dos clientes |
| **IA** | OpenAI GPT-4o | Melhor custo/benefício, função calling |
| **Backend** | Node.js + Express | Rápido, prático, JavaScript |
| **Banco de Dados** | PostgreSQL | Robusto, suporta JSONB para histórico |
| **Imóveis** | SR Proprietário API | Integração com sistema existente |
| **CRM** | IMOVIEW API | Gestão de leads e agendamentos |
| **Logs** | Winston | Estruturado, múltiplos transportes |

---

## 📝 Logs

Os logs estão disponíveis em:
- **Console**: em tempo real durante execução
- **Arquivo**: `logs/combined.log` (todos os eventos)
- **Arquivo**: `logs/error.log` (apenas erros)

```bash
# Ver logs em tempo real (Docker)
docker-compose logs -f app

# Ver logs locais
tail -f logs/combined.log
```

---

## 🚢 Deploy em Produção

### Com Docker (Recomendado)

```bash
# 1. Build da imagem
docker-compose build

# 2. Push para registry (Docker Hub, AWS ECR, etc.)
docker tag chatbot_imobiliaria_app seu-registry/chatbot:latest
docker push seu-registry/chatbot:latest

# 3. Pull e deploy em servidor
docker-compose pull
docker-compose up -d
```

### Checklist de Produção

- [ ] `NODE_ENV=production` no `.env`
- [ ] `WHATSAPP_ACCESS_TOKEN` com token real (não teste)
- [ ] `OPENAI_API_KEY` com limite de custo configurado
- [ ] `DATABASE_URL` apontando para DB em servidor seguro
- [ ] HTTPS configurado (nginx com Let's Encrypt)
- [ ] PostgreSQL com backups automáticos
- [ ] Monitoramento de uptime (Healthchecks.io, Sentry, etc.)
- [ ] Logs persistidos (ELK Stack, Datadog, etc.)

---

## ✅ Validação e Testes

### Script de validação
```bash
./test-setup.sh
```

### Health check
```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T12:34:56.789Z",
  "services": {
    "database": "ok",
    "whatsapp": "configured",
    "openai": "configured",
    "srProprietario": "configured",
    "imoview": "configured"
  }
}
```

---

## 🆘 Troubleshooting

Para problemas comuns, consulte [DOCKER_SETUP.md#-troubleshooting-comum](DOCKER_SETUP.md#-troubleshooting-comum).

**Dúvidas frequentes:**

**Q: Posso usar outra API de IA (Claude, Gemini, etc.)?**  
A: Sim, adapte `src/services/openai.js` para usar outro SDK.

**Q: Como integrar com WhatsApp Web sem Meta?**  
A: Use Evolution API ou similar, adapte `src/services/whatsapp.js`.

**Q: Qual é o custo mensal?**  
A: Depende do volume. Estimativa: $100-$300 (OpenAI) + $10-$50 (WhatsApp) + infraestrutura.

---

## 📞 Links Úteis

- [Meta for Developers](https://developers.facebook.com) — Obter chaves WhatsApp
- [OpenAI Platform](https://platform.openai.com) — Criar chave API GPT-4
- [PostgreSQL Docs](https://www.postgresql.org/docs/) — Documentação do banco
- [Node.js Docs](https://nodejs.org/docs/) — Documentação Node.js

Para suporte das APIs:
- **SR Proprietário**: Contate suporte deles
- **IMOVIEW CRM**: Contate suporte deles
- **Meta WhatsApp**: [developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp)
