# Referência Completa de Comandos

Guia detalhado de todos os comandos disponíveis (Makefile + npm scripts).

---

## 📋 Sumário rápido

Execute `make help` a qualquer momento para ver todos os comandos:

```bash
make help
```

---

## 🚀 Comandos principais

### `make start` — Start completo (recomendado)

```bash
make start
```

**O que faz:**

- ✅ Verifica se `.env` existe (cria do exemplo se não houver)
- ✅ Sobe PostgreSQL + app em Docker Compose
- ✅ Aplica migrations pendentes
- ✅ Aguarda health check passar

**Saída esperada:**

```
✓ .env configurado
✓ Containers subindo...
✓ Migrations aplicadas
✓ App saudável em http://localhost:3000
```

**Tempo:** ~30-60s na primeira execução

### `make stop` — Para todos os containers

```bash
make stop
```

**O que faz:**

- ✅ Para PostgreSQL + app
- ✅ **Preserva dados** (volume do banco permanece)

**Equivalentes:**

```bash
docker compose down
```

---

## 🐳 Docker Compose — Controle granular

### `make dev-docker` — Sobe stack de dev

```bash
make dev-docker
```

Equivalente a: `docker compose up -d`

**O que sobe:**

- PostgreSQL (porta 5432)
- App Node.js (porta 3000)

**Status:**

```bash
docker compose ps
```

### `make dev-down` — Para containers de dev

```bash
make dev-down
```

Equivalente a: `docker compose down`

**Com volume (destrói dados):**

```bash
docker compose down -v
```

### `make dev-logs` — Segue logs do app

```bash
make dev-logs
```

Mostra logs em tempo real:

```
app    | 2026-05-21T01:30:00.123Z INFO: Server listening on port 3000
app    | 2026-05-21T01:30:01.456Z DEBUG: Connected to database
```

**Parar logs:** `Ctrl+C`

**Ver todos os containers:**

```bash
docker compose logs -f
```

### `make dev-build` — Reconstrói a imagem

```bash
make dev-build
```

Use após alterar código ou dependências:

```bash
# Alterar src/index.ts
make dev-build  # Reconstrói e reinicia
# App atualizado em ~30s
```

### `make dev-db-shell` — Acesso direto ao banco

```bash
make dev-db-shell
```

Abre `psql` dentro do container:

```sql
chatbot_imobiliaria=# SELECT COUNT(*) FROM "Conversation";
 count
-------
    5
(1 row)
```

**Sair:** `\q`

---

## 💻 Desenvolvimento local (sem Docker)

### `make dev` ou `npm run dev` — Dev com hot-reload

```bash
make dev
```

**Requer:** PostgreSQL rodando (localmente ou via `make dev-docker` em outro terminal)

**Comportamento:**

- Usa `tsx watch` para hot-reload
- Reinicia a cada mudança em `.ts`
- Logs em tempo real

**Saída:**

```
[11:30:00] File change detected. Restarting...
Server listening on http://localhost:3000
```

---

## 🗄️ Banco de dados

### `make migrate` ou `npm run db:migrate` — Criar/aplicar migration

```bash
make migrate
```

**Fluxo interativo:**

```
✔ What is the name of your migration? › Add user table
✔ Your migration is ready at prisma/migrations/20250521_add_user_table
Run npm run db:migrate to apply it
```

**Ver migrations:**

```bash
ls prisma/migrations/
```

### `make studio` ou `npm run db:studio` — Prisma Studio

```bash
make studio
```

Abre interface web em `http://localhost:5555`:

- Visualizar dados
- Editar registros
- Criar novos registros
- Exportar dados

### `npm run db:deploy` — Aplicar migrations (CI/deploy)

```bash
npm run db:deploy
```

**Quando usar:** Produção, CI, ou após fazer pull de migrations novas

**Diferença vs `db:migrate`:**

- `migrate` — interativo, cria migrations novas
- `deploy` — silencioso, aplica já existentes

### `npm run db:generate` — Regenerar Prisma Client

```bash
npm run db:generate
```

Raro. Use se:

- Prisma Client corromper
- Alterar `schema.prisma` manualmente

---

## ✅ Qualidade & Testes

### `make test` ou `npm test` — Rodar testes

```bash
make test
```

**Saída:**

```
✓ src/modules/chat/chat.service.test.ts (5 tests)
✓ src/modules/ai/openai.service.test.ts (3 tests)
✓ src/modules/whatsapp/uazapi.mapper.test.ts (18 tests)

Test Files  3 passed (3)
Tests  26 passed (26)
Time  2.5s
```

### `npm run test:watch` — Testes em watch mode

```bash
npm run test:watch
```

Reexecuta testes a cada mudança. Útil durante desenvolvimento.

### `npm run test:coverage` — Cobertura com thresholds

```bash
npm run test:coverage
```

Gera relatório e **falha se cair abaixo de 95%**:

```
Thresholds validation:
  ✓ statements: 98.5% > 95%
  ✓ branches: 96.2% > 95%
  ✓ functions: 99.1% > 95%
  ✓ lines: 98.3% > 95%
```

**Ver relatório HTML:**

```bash
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

### `make lint` ou `npm run lint` — ESLint + Prettier

```bash
make lint
```

**Verifica:**

- ✅ ESLint (regras de código)
- ✅ Prettier (formatação)

**Não corrige**, apenas reporta.

### `npm run lint:fix` — ESLint com --fix

```bash
npm run lint:fix
```

Tenta corrigir automaticamente.

### `npm run format` — Prettier (formatar tudo)

```bash
npm run format
```

Formata todos os arquivos:

```
 src/index.ts
 src/server.ts
 src/config/env.ts
 docs/gitflow.md
```

### `npm run format:check` — Verificar formatação

```bash
npm run format:check
```

Não altera, apenas lista o que precisa ser formatado.

### `npm run typecheck` — TypeScript type-check

```bash
npm run typecheck
```

Valida tipos (sem compilar):

```
error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'
```

### `make build` ou `npm run build` — Compilar TypeScript

```bash
make build
```

Gera `dist/`:

```
dist/
├── index.js
├── server.js
├── config/
├── lib/
├── http/
└── modules/
```

---

## 🚢 Produção (local testing)

### `make prod-up` — Sobe stack de produção

```bash
make prod-up
```

**Requer:** `DOCKER_IMAGE` configurado em `.env`

**O que sobe:**

- PostgreSQL (sem exposição externa)
- App com Caddy (HTTPS automático)

### `make prod-down` — Para produção

```bash
make prod-down
```

### `make prod-logs` — Logs de produção

```bash
make prod-logs
```

### `make prod-restart` — Reinicia sem rebuild

```bash
make prod-restart
```

Use se a imagem já existe e quer só reiniciar:

```bash
# Vs make prod-up que rebuilda se houver mudanças
```

---

## 🔍 Verificação de dependências

### `npm audit` — Auditoria de segurança

```bash
npm audit
```

Mostra vulnerabilidades:

```
high  Cross-site Scripting (XSS) in lodash
```

**Corrigir:**

```bash
npm audit fix
```

**Na CI:** O build falha se houver vulnerabilidade alta/crítica.

---

## 📋 Utilitários

### `npm run clean` — Limpar cache/build

Se houver:

```bash
npm run clean
npm install
```

### Ver todos os scripts npm

```bash
npm run
```

Mostra todos os scripts em `package.json`.

### Ver todos os targets Makefile

```bash
make help
```

---

## ⚙️ Ordem recomendada no desenvolvimento

### Primeira vez

```bash
# Terminal 1
make start                      # Sobe stack

# Terminal 2 (em paralelo)
make dev-logs                   # Acompanha logs
```

### Desenvolvendo uma feature

```bash
# Terminal 1 (se usando Docker)
# make dev-docker ainda rodando

# Terminal 2 (se local, sem Docker)
make dev                        # Hot-reload

# Fazer mudanças...
# Testes rodam automaticamente (se em watch)

# Terminal 3
npm run lint                    # Verificar qualidade antes de commit
npm run test:coverage           # Garantir cobertura >= 95%
```

### Antes de fazer push

```bash
npm run lint:fix                # Corrigir problemas
npm run typecheck               # Type safety
npm test                        # Testes
npm run build                   # Build final
```

### Depois de merge em develop

```bash
# CI/CD cuida de tudo automaticamente
# Mas para testar localmente:

git pull origin develop
make dev-build                  # Reconstrói com código novo
```

---

## 🆘 Troubleshooting por erro

| Erro                                              | Comando                  | Solução                               |
| ------------------------------------------------- | ------------------------ | ------------------------------------- |
| `docker not found`                                | `make start`             | Instale Docker                        |
| `Error: Command failed with exit code 1` em tests | `npm test`               | `npm run test:coverage` para detalhes |
| `ESlint error in src/index.ts`                    | `make lint`              | `npm run lint:fix`                    |
| `Cannot find module`                              | Qualquer                 | `npm install` e `npm run db:generate` |
| Código desatualizado no app                       | `make dev-build`         | Reconstrói com código novo            |
| Banco corrompido                                  | `docker compose down -v` | Limpa volume, recria                  |
| Type errors em produção                           | `npm run typecheck`      | Roda localmente antes de push         |

---

## 📚 Próxima leitura

- [quick-start.md](quick-start.md) — Começar em 5 minutos
- [development.md](development.md) — Workflow completo com Git
- [docker-setup.md](docker-setup.md) — Detalhes de containers
- [gitflow.md](gitflow.md) — Fluxo de branches e deploy
