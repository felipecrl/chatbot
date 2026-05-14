# Chatbot WhatsApp para Imobiliárias

Atendimento automatizado no WhatsApp com IA: entende o que o cliente procura, busca imóveis,
descreve as opções e agenda visitas — registrando o lead no CRM. Integra **OpenAI (GPT-4)**,
**Meta Cloud API (WhatsApp Business)** e **IMOVIEW** (catálogo de imóveis + CRM).

**Stack:** Node.js · TypeScript · Express · Prisma · PostgreSQL · OpenAI · Vitest

> Este projeto começou como um MVP e foi refatorado para uma base profissional e escalável:
> TypeScript em modo `strict`, arquitetura modular com injeção de dependências, validação de
> configuração e payloads, camada de acesso a dados com Prisma, testes automatizados, lint/format
> e CI.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Rodando localmente](#rodando-localmente)
- [Rodando com Docker](#rodando-com-docker)
- [Banco de dados / migrations](#banco-de-dados--migrations)
- [Scripts disponíveis](#scripts-disponíveis)
- [Testes, lint e build](#testes-lint-e-build)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Endpoints HTTP](#endpoints-http)
- [Deploy](#deploy)
- [Documentação adicional](#documentação-adicional)

---

## Arquitetura

A aplicação segue uma arquitetura modular em camadas. Cada módulo de domínio expõe um
_service_ (regras) e, quando há persistência, um _repository_ (acesso a dados via Prisma).
As integrações externas ficam isoladas atrás de _services_ dedicados, o que torna o `ChatService`
(orquestrador) testável com mocks.

```
src/
├── index.ts                      # ponto de entrada
├── server.ts                     # bootstrap HTTP + graceful shutdown + jobs
├── container.ts                  # composition root (injeção de dependências)
├── config/                       # carregamento e validação de env (zod) + config tipada
├── lib/                          # logger (winston), erros (AppError), http client (axios)
├── db/                           # PrismaClient singleton + health check
├── http/                         # camada web
│   ├── app.ts                    # fábrica do app Express (helmet, parsers, rotas)
│   ├── middlewares/              # error handler, request logger, async handler, assinatura do webhook
│   └── routes/                   # /health, /webhook
├── modules/
│   ├── ai/                       # OpenAI (tool calling) + mock + prompts + interface AiService
│   ├── chat/                     # ChatService (orquestrador) + ferramentas expostas ao LLM
│   ├── conversations/            # ConversationRepository (histórico, estado)
│   ├── leads/                    # LeadRepository + LeadService (persistência + sync CRM)
│   ├── crm/                      # CrmService (IMOVIEW)
│   ├── properties/               # PropertyService (Imoview) + catálogo de exemplo
│   └── whatsapp/                 # WhatsAppService (envio), mapper (payload), verificação de assinatura
└── types/                        # type augmentations
prisma/
├── schema.prisma                 # modelos Conversation e Lead
└── migrations/                   # migrations versionadas
```

**Fluxo de uma mensagem:** Meta → `POST /webhook` (responde `200` na hora) → `ChatService`
processa em background → `AiService.chat()` com as ferramentas (`buscar_imoveis`,
`obter_detalhes_imovel`, `agendar_visita`, `transferir_para_humano`) → resposta enviada ao
usuário via `WhatsAppService`. Sem `OPENAI_API_KEY` configurada, um `MockAiService` responde
sem custo; sem `IMOVIEW_*`, um catálogo de exemplo é usado e os leads ficam apenas no banco local.

---

## Pré-requisitos

- **Node.js >= 20** (ver `.nvmrc` — recomendado Node 22)
- **PostgreSQL 14+** (ou use o `docker-compose`)
- Conta na **Meta for Developers** com um app WhatsApp Business (ver [docs/webhook-setup.md](docs/webhook-setup.md))
- Opcional: chave de API da **OpenAI** (sem ela, o modo mock é ativado automaticamente)

---

## Configuração

```bash
cp .env.example .env
# preencha pelo menos: DATABASE_URL, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN
# (OPENAI_API_KEY é opcional — sem ela o chatbot roda em modo mock)
```

A configuração é validada na inicialização ([`src/config/env.ts`](src/config/env.ts)). Se faltar
ou estiver inválida alguma variável obrigatória, o processo encerra com uma mensagem clara.

---

## Rodando localmente

```bash
npm install                 # instala deps e gera o Prisma Client (postinstall)
npm run db:deploy           # aplica as migrations no banco apontado por DATABASE_URL
npm run dev                 # inicia em modo watch (tsx)
```

A API sobe em `http://localhost:3000`. Para expor o webhook em desenvolvimento, use um túnel
(ex.: ngrok) — ver [docs/webhook-setup.md](docs/webhook-setup.md).

Dicas para desenvolvimento sem custos / sem WhatsApp real:

- `USE_MOCK_AI=true` — usa respostas simuladas em vez da OpenAI (padrão quando `OPENAI_API_KEY` está vazia)
- `SKIP_WHATSAPP_SEND=true` — não envia mensagens ao WhatsApp, apenas registra nos logs

---

## Rodando com Docker

Existem dois modos de uso com Docker Compose.

**Desenvolvimento** — build local, banco exposto na porta 5432:

```bash
cp .env.example .env   # defaults já seguros para dev (USE_MOCK_AI=true, SKIP_WHATSAPP_SEND=true)
make dev-docker        # sobe postgres + app (build local)
make dev-logs          # acompanha os logs
curl http://localhost:3000/health
```

Para reconstruir a imagem após alterar o código:

```bash
make dev-build
```

**Produção** — imagem pré-construída do ghcr.io, Caddy com HTTPS, banco sem exposição externa:

```bash
make prod-up           # usa docker-compose.yml + docker-compose.prod.yml
```

O container aplica as migrations automaticamente (`prisma migrate deploy`) antes de subir.
Detalhes e troubleshooting em [docs/docker-setup.md](docs/docker-setup.md).

---

## Banco de dados / migrations

O schema vive em [`prisma/schema.prisma`](prisma/schema.prisma) (modelos `Conversation` e `Lead`).

```bash
npm run db:migrate          # cria/aplica uma migration em desenvolvimento (prisma migrate dev)
npm run db:deploy           # aplica migrations pendentes (produção / CI)
npm run db:generate         # regenera o Prisma Client
npm run db:studio           # abre o Prisma Studio
```

---

## Scripts disponíveis

Execute `make help` para listar todos os atalhos disponíveis. Principais:

| Makefile / npm script                 | Descrição                            |
| ------------------------------------- | ------------------------------------ |
| `make dev` / `npm run dev`            | Servidor em modo watch (`tsx watch`) |
| `make dev-docker`                     | Sobe stack completo em Docker (dev)  |
| `make dev-down`                       | Derruba containers de dev            |
| `make dev-logs`                       | Segue os logs do app em dev          |
| `make prod-up`                        | Sobe com overrides de produção       |
| `make prod-down`                      | Derruba containers de prod           |
| `make migrate` / `npm run db:migrate` | Cria e aplica migration (dev)        |
| `make studio` / `npm run db:studio`   | Abre o Prisma Studio                 |
| `make test` / `npm test`              | Vitest (uma vez)                     |
| `make lint`                           | ESLint + verificação de formatação   |
| `make build` / `npm run build`        | Compila TypeScript para `dist/`      |
| `npm run compose:dev`                 | Alias de `make dev-docker`           |
| `npm run compose:prod`                | Alias de `make prod-up`              |
| `npm run test:watch`                  | Vitest em watch                      |
| `npm run test:coverage`               | Vitest com cobertura                 |

---

## Testes, lint e build

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Os testes são unitários (Vitest) com dependências mockadas — não precisam de banco nem de rede.
O pipeline de CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) roda lint, checagem de
formatação, type-check, build e testes em cada push/PR.

---

## Variáveis de ambiente

Lista completa e comentada em [`.env.example`](.env.example). Resumo:

| Variável                                              | Obrigatória | Padrão                             | Descrição                                                       |
| ----------------------------------------------------- | ----------- | ---------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                                            | não         | `development`                      | `development` \| `test` \| `production`                         |
| `PORT`                                                | não         | `3000`                             | Porta HTTP                                                      |
| `LOG_LEVEL`                                           | não         | `debug` (dev) / `info` (prod)      | `error` \| `warn` \| `info` \| `http` \| `debug`                |
| `DATABASE_URL`                                        | **sim**     | —                                  | URL de conexão do PostgreSQL                                    |
| `WHATSAPP_ACCESS_TOKEN`                               | **sim**     | —                                  | Token da Meta Cloud API                                         |
| `WHATSAPP_PHONE_NUMBER_ID`                            | **sim**     | —                                  | ID do número de WhatsApp Business                               |
| `WHATSAPP_VERIFY_TOKEN`                               | **sim**     | —                                  | Token de verificação do webhook (você define)                   |
| `WHATSAPP_API_VERSION`                                | não         | `v20.0`                            | Versão da Graph API                                             |
| `WHATSAPP_APP_SECRET`                                 | não         | —                                  | Habilita a verificação da assinatura `X-Hub-Signature-256`      |
| `OPENAI_API_KEY`                                      | não\*       | —                                  | Chave da OpenAI (\*obrigatória se `USE_MOCK_AI` não for `true`) |
| `OPENAI_MODEL`                                        | não         | `gpt-4o`                           | Modelo do chat                                                  |
| `USE_MOCK_AI`                                         | não         | `true` quando sem `OPENAI_API_KEY` | Usa respostas simuladas                                         |
| `IMOVIEW_API_URL` / `_API_KEY` / `IMOVIEW_EMPRESA_ID` | não         | —                                  | Catálogo de imóveis + CRM (sem isso, usa catálogo de exemplo e leads ficam só no banco local) |
| `SKIP_WHATSAPP_SEND`                                  | não         | `false`                            | Não envia mensagens ao WhatsApp (apenas loga)                   |
| `EMPRESA_NOME` / `EMPRESA_CIDADE`                     | não         | `Imobiliária` / `Belo Horizonte`   | Usados nas respostas                                            |
| `MAX_IMOVEIS_POR_RESPOSTA`                            | não         | `3`                                | Máximo de imóveis por resposta                                  |
| `CONVERSA_TIMEOUT_MINUTOS`                            | não         | `60`                               | Inatividade antes de encerrar a conversa                        |
| `CONVERSATION_CLEANUP_INTERVAL_MINUTES`               | não         | `60`                               | Frequência do job de limpeza                                    |

---

## Endpoints HTTP

| Método | Rota       | Descrição                                                                                                                                                  |
| ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/`        | Identificação do serviço                                                                                                                                   |
| `GET`  | `/health`  | Health check (verifica o banco) — `200` saudável, `503` degradado                                                                                          |
| `GET`  | `/webhook` | Handshake de verificação da Meta (`hub.challenge`)                                                                                                         |
| `POST` | `/webhook` | Recebimento de mensagens (responde `200` imediatamente; processa em background; valida `X-Hub-Signature-256` se `WHATSAPP_APP_SECRET` estiver configurado) |

---

## Deploy

O deploy em produção é feito automaticamente pelo pipeline de CI/CD
([.github/workflows/ci.yml](.github/workflows/ci.yml)) a cada push na branch `main`:

1. **build** — lint, type-check, build e testes
2. **publish** — constrói imagem multi-arch (`linux/amd64` + `linux/arm64`) e publica no `ghcr.io`
3. **deploy** — sincroniza arquivos via rsync, faz `docker compose pull` da nova imagem e reinicia
   os containers na Oracle VM via SSH

A imagem é multi-stage (build + runtime enxuto, usuário não-root, `HEALTHCHECK` nativo). O Caddy
cuida do HTTPS automático.

Para subir manualmente em produção (requer `DOCKER_IMAGE` configurado no `.env` da VM):

```bash
make prod-up
```

Ajuste o domínio em [`Caddyfile`](Caddyfile) e configure o webhook na Meta apontando para
`https://SEU_DOMINIO/webhook`.

---

## Documentação adicional

- [docs/webhook-setup.md](docs/webhook-setup.md) — configuração do app na Meta e do webhook
- [docs/docker-setup.md](docs/docker-setup.md) — Docker / PostgreSQL / troubleshooting
