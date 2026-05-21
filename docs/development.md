# Guia de Desenvolvimento

Tudo sobre trabalhar localmente neste projeto, incluindo Husky, hooks Git, e boas práticas.

---

## Setup inicial

```bash
# Clone e instale
git clone https://github.com/felipecrl/chatbot.git
cd chatbot
npm install

# Instale os Git hooks (Husky)
npx husky install

# Configure o .env para desenvolvimento
cp .env.example .env
# Edite .env com suas credenciais (UAZAPI_INSTANCE_TOKEN, etc)

# Inicie o banco de dados
npm run compose:dev

# Rode as migrations
npm run db:deploy

# Inicie o servidor
npm run dev
```

Pronto! API rodando em `http://localhost:3000`.

---

## Fluxo de trabalho com Husky

### O que é Husky?

Husky é um gerenciador de Git hooks que **intercepta seus commits** para executar checks automáticos:

- **Prettier**: formata código
- **ESLint**: corrige problemas de linting

**Você nunca precisa rodar `npm run format` manualmente** — Husky faz isso para você.

### Como funciona

```
$ git commit -m "minha funcionalidade"

🎯 Husky intercepta (pré-commit hook)
   ↓
✓ lint-staged executa:
   ├─ prettier --write *.ts (formata)
   ├─ eslint --fix *.ts (corrige linting)
   └─ prettier --write *.json,*.md,*.yml (outros arquivos)
   ↓
📝 Arquivos são atualizados automaticamente
   ↓
git add [arquivos formatados]
   ↓
✅ Commit prossegue normalmente
```

### Exemplo prático

```bash
# Você edita um arquivo com formatação incorreta
echo "const x=1" > src/example.ts

# Commit normalmente
git add src/example.ts
git commit -m "example: add new variable"

# Husky intercepta e formata automaticamente
# ✓ prettier --write src/example.ts
# ✓ eslint --fix src/example.ts

# Arquivo foi atualizado de:
#   const x=1
# Para:
#   const x = 1;

# Commit continua normalmente ✅
```

### Arquivos envolvidos

- [`.husky/pre-commit`](.husky/pre-commit) — Hook que dispara `lint-staged`
- [`package.json`](../package.json) — Configuração de `lint-staged` e `husky`

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,md,yml,yaml}": "prettier --write",
    "*.{ts,tsx,js,jsx}": "eslint --fix"
  }
}
```

---

## Desenvolvimento local

### Modo watch com hot reload

```bash
npm run dev
```

Inicia `tsx watch` que recompila e reinicia o servidor a cada mudança.

### Rodando testes

```bash
# Uma única execução
npm test

# Watch mode
npm run test:watch

# Com cobertura
npm run test:coverage
```

### Lint e formatação manual (opcional)

Se quiser rodar manualmente (não é necessário pois Husky já faz):

```bash
npm run lint             # ESLint apenas
npm run format:check     # Verifica formatação
npm run format           # Formata tudo (Prettier)
npm run lint:fix         # ESLint com --fix
```

### Typecheck

```bash
npm run typecheck
```

### Build

```bash
npm run build            # Compila para dist/
npm run build && npm start  # Build + executa
```

---

## Git hooks (Husky)

### Reinstalar hooks (se por algum motivo forem perdidos)

```bash
npx husky install
```

Isso recreia os arquivos em `.husky/`.

### Desabilitar hooks temporariamente

Se precisar skipar os checks de uma vez (último recurso):

```bash
git commit --no-verify -m "mensagem"
```

⚠️ **Aviso:** Isso bypassa Husky e pode causar falhas em CI/CD.

### Verificar se hooks estão funcionando

```bash
# Crie um arquivo mal formatado
echo "const x=1" > test.ts

# Tente fazer commit
git add test.ts
git commit -m "test"

# Husky deve interceptar e formatar
# Se nada acontecer, rode: npx husky install
```

---

## Padrões de commit

Embora o Husky formata o código, recomendamos usar **Conventional Commits** para mensagens:

```
type(scope): subject

[optional body]
[optional footer]
```

### Exemplos

```
feat(webhook): add retry logic for failed messages
fix(chat): correct timeout calculation
docs(readme): update deploy section
chore(deps): upgrade typescript to 5.8
test(ai): add tests for mock service
```

**Tipos comuns:**

- `feat` — Nova funcionalidade
- `fix` — Correção de bug
- `docs` — Documentação
- `test` — Testes
- `chore` — Dependências, builds, etc
- `refactor` — Refatoração sem mudança de behavior
- `style` — Formatação (normalmente feito por Prettier/ESLint)
- `perf` — Melhoria de performance

---

## Environment para desenvolvimento

Crie um `.env` baseado em [`.env.example`](../.env.example):

```bash
# Obrigatório
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot_dev

# WhatsApp (use uazapi para dev)
WHATSAPP_PROVIDER=uazapi
UAZAPI_INSTANCE_TOKEN=seu_token_aqui  # Obtenha em uazapi.dev

# IA (deixe em branco para usar mock)
USE_MOCK_AI=true
# ou configure uma chave real:
OPENAI_API_KEY=sk-...

# Logging
LOG_LEVEL=debug

# Opcional
SKIP_WHATSAPP_SEND=true  # Não envia de verdade ao WhatsApp
EMPRESA_NOME="Minha Imobiliária"
EMPRESA_CIDADE="São Paulo"
```

---

## Docker Compose para dev

O projeto inclui um `docker-compose.yml` para PostgreSQL e dependências:

```bash
# Sobe apenas o banco
npm run compose:dev

# Vê os logs
docker compose logs -f postgres

# Desce tudo
npm run compose:dev:down
```

---

## Troubleshooting

### "Husky não está formatando"

```bash
# Verifique se os hooks estão instalados
npx husky install

# Verifique se lint-staged está no package.json
cat package.json | grep -A 3 '"lint-staged"'

# Tente fazer um commit normalmente
git add .
git commit -m "test"
```

### "Pre-commit hook falhou com erro X"

- Se for erro de Prettier: rode `npm run format` localmente e tente novamente
- Se for erro de ESLint: rode `npm run lint:fix` e tente novamente
- Se for erro de type: rode `npm run typecheck` para ver detalhes

### "Quero desabilitar Husky temporariamente"

```bash
# Uma vez
git commit --no-verify -m "skip hooks"

# Para desabilitar permanentemente (não recomendado)
npx husky uninstall
```

### "Recebi erro 'Cannot find module lint-staged'"

```bash
npm install --save-dev lint-staged
npx husky install
```

---

## Database

### Migrations

```bash
# Cria uma nova migration interativamente
npm run db:migrate

# Aplica migrations pendentes (CI/deploy)
npm run db:deploy

# Regenera o Prisma Client (rare)
npm run db:generate
```

### Prisma Studio (UI para banco)

```bash
npm run db:studio
```

Abre `http://localhost:5555` com interface visual.

### Reset do banco (apenas dev)

```bash
# ⚠️ DESTRÓI TODOS OS DADOS
npx prisma migrate reset
```

---

## Boas práticas

1. **Sempre puxe antes de começar:**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/meu-recurso
   ```

2. **Commits pequenos e lógicos:**
   - Um commit por feature/fix lógico
   - Mensagens descritivas

3. **Confie no Husky:**
   - Não se preocupe se a formatação está errada
   - Husky cuida disso no commit

4. **Teste antes de fazer push:**

   ```bash
   npm run lint && npm run typecheck && npm test
   ```

5. **Use branches descritivas:**

   ```
   ✅ feature/webhook-retry-logic
   ✅ fix/conversation-timeout-bug
   ❌ feature/xyz
   ❌ fix/bug
   ```

6. **Commits frequentes:**
   - Mais fácil revertir se algo der errado
   - Histórico mais claro

---

## Integrações IDE

### VS Code

Instale as extensões:

- **ESLint** (Microsoft)
- **Prettier** (Prettier)
- **Husky** (opcional, já funciona automaticamente)

Elas irão:

- Mostrar linting errors enquanto você digita
- Sugerir correções rápidas
- Formatar ao salvar (se configurado em `settings.json`)

### WebStorm / IntelliJ

- Ativa ESLint e Prettier automaticamente
- Mostra erros em tempo real
- Integra com Husky

---

## Links úteis

- [docs/gitflow.md](gitflow.md) — Fluxo de branches (feature, hotfix, promotion)
- [docs/ci-cd.md](ci-cd.md) — Workflows de CI/CD
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Husky docs](https://typicode.github.io/husky/)
- [lint-staged docs](https://github.com/lint-staged/lint-staged)
