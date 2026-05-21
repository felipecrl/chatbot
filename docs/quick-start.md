# Quick Start — Começar a desenvolver em 5 minutos

Guia rápido para configurar e rodar o projeto localmente.

---

## 1️⃣ Clone e instale

```bash
git clone https://github.com/felipecrl/chatbot.git
cd chatbot
npm install
```

**O que acontece:** `npm postinstall` gera o Prisma Client automaticamente.

---

## 2️⃣ Configure variáveis de ambiente

```bash
cp .env.example .env
```

Para **desenvolvimento local**, o `.env.example` já tem bons defaults:

```bash
# Verificar/ajustar se necessário:
WHATSAPP_PROVIDER=uazapi           # Use uazapi para dev (gratuito)
UAZAPI_INSTANCE_TOKEN=seu_token    # Obtenha em https://uazapi.dev
USE_MOCK_AI=true                   # Sem custo de OpenAI
SKIP_WHATSAPP_SEND=true            # Não envia de verdade ao WhatsApp
LOG_LEVEL=debug
```

> **Para produção:** veja [Deploy](#deploy) no README.

---

## 3️⃣ Inicie o projeto

### Opção A: Com Docker (recomendado)

```bash
make start
```

**O que faz:**

1. ✅ Verifica se `.env` existe (cria do exemplo se não houver)
2. ✅ Sobe PostgreSQL + app em containers
3. ✅ Aplica migrations automaticamente
4. ✅ App rodando em `http://localhost:3000`

### Opção B: Localmente (requer PostgreSQL instalado)

```bash
# Terminal 1: Inicie o banco
docker run --name chatbot_db -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_USER=chatbot_user -e POSTGRES_DB=chatbot_imobiliaria \
  -p 5432:5432 postgres:14

# Terminal 2: Aplique migrations
npm run db:deploy

# Terminal 3: Inicie o app
npm run dev
```

---

## 4️⃣ Verifique se está funcionando

```bash
# Health check
curl http://localhost:3000/health

# Deve retornar:
# {"status":"ok","database":"connected"}
```

---

## 5️⃣ Próximos passos

### Ver logs em tempo real

```bash
make dev-logs
# ou com Docker diretamente:
docker compose logs -f app
```

### Parar o projeto

```bash
make stop
# Containers param, dados são preservados
```

### Reconstruir após alterar código

```bash
make dev-build
# Força rebuild da imagem Docker
```

---

## Troubleshooting rápido

| Erro                                         | Solução                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `docker: command not found`                  | Instale [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL não está rodando; use `make start` ou instale localmente      |
| `Error: 'npm' is not recognized`             | Instale [Node.js](https://nodejs.org/) v20+                              |
| `Health check falha`                         | Aguarde 10s para migrations rodarem; veja logs com `make dev-logs`       |

---

## Próxima leitura

- [docs/development.md](development.md) — Fluxo completo com Husky, Git hooks, testes
- [docs/gitflow.md](gitflow.md) — Como criar features, PRs e deploy
- [docs/docker-setup.md](docker-setup.md) — Detalhes de containers e ambientes
