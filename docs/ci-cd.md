# CI/CD Pipeline

Documentação detalhada de todos os workflows de CI/CD e o processo de deploy automático.

---

## Arquitetura dos workflows

```
┌────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS                          │
├────────────────────────────────────────────────────────────┤
│  1. auto-pr.yml             → Cria PR automaticamente       │
│  2. validate-pr.yml         → CI para PRs (lint, build)    │
│  3. promote.yml             → Promove entre envs (auto)    │
│  4. deploy-production.yml   → Build Docker + Deploy SSH    │
│  5. reusable-ci.yml         → Workflow reutilizável        │
└────────────────────────────────────────────────────────────┘
```

---

## 1. auto-pr.yml — Criação automática de PR

**Trigger:** Push para branches `feature/*`, `fix/*`, `hotfix/*`

**O que faz:**

1. Detecta o tipo de branch (feature/fix vs hotfix)
2. Define a branch base automaticamente:
   - `feature/*` e `fix/*` → base = `develop`
   - `hotfix/*` → base = `main`
3. Cria uma PR automaticamente se não existir
4. Para hotfix, adiciona label `hotfix`

**Configuração necessária:**

- `GH_PAT` secret com escopos: `repo`, `read:org`

**Exemplo:**

```bash
git push origin feature/webhook-retry
# → auto-pr.yml dispara
# → PR criada automaticamente: feature/webhook-retry → develop
```

---

## 2. validate-pr.yml — CI para PRs

**Trigger:** PR aberta/atualizada (que aponta para develop ou main)

**O que faz:**

1. Chama `reusable-ci.yml` com diferentes configurações:
   - Se destino = `develop`: `docker-build=false` (mais rápido)
   - Se destino = `homolog` ou `main`: `docker-build=true` (testa imagem)

**Saídas:**

```
✓ Lint (ESLint + Prettier)
✓ Type check (TypeScript)
✓ Build (tsc → dist/)
✓ Tests (Vitest)
✓ Docker build test (só para homolog/main)
```

**Tempo típico:**

- Develop PR: ~2-3 min
- Homolog/main PR: ~5-7 min (Docker build)

---

## 3. reusable-ci.yml — Workflow reutilizável (centralized CI)

**Trigger:** Chamado por `validate-pr.yml`

**Inputs:**

- `docker-build` (boolean, default=true): executar build Docker?

**Jobs:**

```yaml
1. ci
├─ Lint (ESLint + Prettier check)
├─ Type check (TypeScript)
├─ Build (npm run build)
└─ Test (npm run test)

2. docker-build (se docker-build=true)
└─ Build multi-arch (linux/amd64 + linux/arm64)
```

**Secrets necessários:**

Nenhum — usa apenas dependências públicas (Node, npm).

**Logs:**

Veja em GitHub → Actions → workflow → job output.

---

## 4. promote.yml — Promoção automática entre ambientes

**Trigger:** Push para `develop` ou `homolog`, ou merge de hotfix para `main`

**O que faz:**

### Job 1: develop → homolog (auto)

Quando há um push em `develop` (após merge de uma PR):

```
develop push
    ↓
[promote.yml] Job 1
    ↓
Cria/atualiza PR develop → homolog
    ↓
CI + Docker build test
    ↓
Status: Awaiting review
```

### Job 2: homolog → main (auto)

Quando há um push em `homolog`:

```
homolog push
    ↓
[promote.yml] Job 2
    ↓
Cria/atualiza PR homolog → main
    ↓
CI + requer 1 reviewer
    ↓
Status: Awaiting review
```

### Job 3: Backport de hotfix (auto)

Quando um PR com label `hotfix` é mergeado em `main`:

```
main push + label:hotfix
    ↓
[promote.yml] Job 3
    ↓
Cria PR main → develop (backport automático)
    ↓
Status: Ready to merge
```

**Configuração necessária:**

- `GH_PAT` secret com escopos: `repo`, `read:org`

---

## 5. deploy-production.yml — Deploy em produção

**Trigger:** Push para `main` (após merge)

**O que faz:**

### Job 1: CI

Chama `reusable-ci.yml` com `docker-build=true`:

```
✓ Lint + Type check + Build + Tests
✓ Docker build test (linux/amd64 + linux/arm64)
```

### Job 2: Publish (Build Docker multi-arch + Push GHCR)

```
Docker build multi-arch
├─ linux/amd64
└─ linux/arm64

Push para GitHub Container Registry (GHCR)
├─ Registry: ghcr.io/felipecrl/chatbot
├─ Tag: latest (main) + git commit SHA
└─ Requer: GITHUB_TOKEN (builtin)
```

### Job 3: Deploy SSH

Sincroniza infra e reinicia containers na VM Oracle:

```
rsync files → Oracle VM
    ↓
docker compose pull (nova imagem)
    ↓
docker compose down && docker compose up -d
    ↓
Health check (curl http://localhost:3000/health)
    ↓
✅ Deploy completo
```

**Configuração necessária:**

Secrets em **GitHub Environment: `production`**:

| Secret         | Descrição                     | Exemplo           |
| -------------- | ----------------------------- | ----------------- |
| `PROD_SSH_KEY` | Chave SSH privada (multiline) | `-----BEGIN...`   |
| `PROD_VM_IP`   | IP da VM                      | `150.230.xxx.xxx` |
| `PROD_VM_USER` | Usuário SSH                   | `ubuntu`          |

**Tempo típico:** 5-10 min (build Docker é lento)

---

## Secrets e Environments

### Global secrets (ações)

```
https://github.com/felipecrl/chatbot/settings/secrets/actions
```

| Secret   | Descrição             | Escopo             | Exemplo       |
| -------- | --------------------- | ------------------ | ------------- |
| `GH_PAT` | Personal Access Token | Todos os workflows | `ghp_xxxx...` |

**Escopos do GH_PAT:**

```
✓ repo (acesso completo)
✓ read:org (ler organização)
✗ write:packages (não necessário)
```

### Environment: production

```
https://github.com/felipecrl/chatbot/settings/environments/production
```

| Secret         | Descrição         |
| -------------- | ----------------- |
| `PROD_SSH_KEY` | Chave SSH privada |
| `PROD_VM_IP`   | IP da VM          |
| `PROD_VM_USER` | Usuário SSH       |

**Como configurar:**

1. Gere uma chave SSH na VM (se ainda não tiver):

   ```bash
   ssh-keygen -t ed25519 -f /tmp/deploy_key -N ""
   cat /tmp/deploy_key  # ← cópia para o GitHub
   cat /tmp/deploy_key.pub >> ~/.ssh/authorized_keys
   ```

2. No GitHub, adicione `PROD_SSH_KEY`:
   ```
   Settings → Environments → production → Secrets
   Add secret "PROD_SSH_KEY" → colar conteúdo de /tmp/deploy_key
   ```

---

## Fluxo completo (ponta a ponta)

```
1️⃣ LOCAL: Você cria branch e faz push
   git push origin feature/xxx

2️⃣ AUTO: auto-pr.yml cria PR para develop

3️⃣ CI: validate-pr.yml roda (lint, build, test)

4️⃣ MANUAL: Você aprova na UI do GitHub

5️⃣ AUTO: Branch é mergeada em develop

6️⃣ AUTO: promote.yml cria PR develop → homolog

7️⃣ CI: validate-pr.yml roda (+ Docker build)

8️⃣ MANUAL: Você aprova a PR de promoção em homolog

9️⃣ AUTO: Branch é mergeada em homolog

🔟 AUTO: promote.yml cria PR homolog → main

1️⃣1️⃣ CI: validate-pr.yml roda (+ Docker build)

1️⃣2️⃣ MANUAL: Código é revisado + 1 reviewer aprova

1️⃣3️⃣ AUTO: Branch é mergeada em main

1️⃣4️⃣ AUTO: deploy-production.yml dispara:
    ├─ CI (lint, build, test, Docker)
    ├─ Publish Docker para GHCR
    └─ Deploy SSH para Oracle VM

1️⃣5️⃣ ✅ LIVE EM PRODUÇÃO
```

---

## Troubleshooting

### "PR não foi criada automaticamente"

**Causa possível:** Falta `GH_PAT` ou escopos insuficientes

**Solução:**

```bash
# Verifique se GH_PAT existe
gh secret list | grep GH_PAT

# Se não existir, crie um novo PAT
# https://github.com/settings/tokens/new
# Escopos: repo, read:org

# Adicione ao GitHub
gh secret set GH_PAT --body "ghp_xxxx..."
```

### "Promoção automática não aconteceu"

**Causa possível:** Merge strategy incorreta ou token sem permissão

**Solução:**

1. Verifique se a branch anterior usou squash merge (não rebase)
2. Verifique os logs em Actions → promote.yml
3. Se o erro for "permission denied", recrie `GH_PAT` com escopos corretos

### "Docker build falhou"

**Causa comum:** Erro de build do TypeScript ou testes falhando

**Solução:**

```bash
# Rode localmente
npm run build
npm run test

# Se falhar localmente, corrija antes de fazer push
```

### "Deploy falhou com erro SSH"

**Causa comum:** Chave SSH inválida ou IP da VM incorreto

**Verificação:**

```bash
# Teste SSH localmente
ssh -i /tmp/prod_key ubuntu@YOUR_VM_IP

# Se funcionar, o problema está no formato da chave no GitHub
# Copie novamente (certifique-se de incluir BEGIN/END)
```

### "Health check falhou após deploy"

**Causa comum:** API não subiu ou container crashed

**Solução:**

```bash
# SSH para a VM
ssh ubuntu@YOUR_VM_IP

# Veja os logs
docker compose logs -f chatbot

# Reinicie containers
docker compose restart
```

### "CI Check names incorretos"

Se você ver erro como `"check 'ci / Lint·Type·Build·Test' was not found"`, é porque o nome do check mudou.

**Solução:**

1. Vá para a PR mergeada mais recente
2. Pegue os nomes exatos:
   ```bash
   gh api repos/felipecrl/chatbot/commits/$(git rev-parse HEAD)/check-runs \
     --jq '.check_runs[].name' | sort -u
   ```
3. Atualize em `.github/workflows/promote.yml` as linhas que mencionam check names

---

## Reruns e debugging

### Rerun de um workflow falho

```bash
# Via CLI
gh run rerun RUN_ID

# Via UI
GitHub → Actions → workflow → Run details → Re-run jobs
```

### Ver logs de um workflow

```bash
# Via CLI
gh run view RUN_ID --log

# Via UI
GitHub → Actions → workflow → Click on run
```

### Debugging local de um workflow

Para testar um workflow antes de fazer push:

```bash
# Instale act (simula GitHub Actions localmente)
brew install act  # ou download em https://github.com/nektos/act

# Execute um workflow
act push --workflows .github/workflows/validate-pr.yml
```

---

## Secrets sensiveis

### Nunca faça push de secrets!

- Chaves SSH
- API keys
- Tokens de acesso

Sempre use GitHub Secrets ou Environment Secrets.

### Se acidentalmente fez push de um secret:

1. **Imediatamente:**

   ```bash
   git reset --soft HEAD~1        # desfaz o commit
   git reset -- arquivo_secreto   # remove arquivo do staging
   rm arquivo_secreto             # remove arquivo local
   git commit -m "remove secret"  # novo commit sem secret
   git push origin feature/xxx
   ```

2. **Revogue o token:**
   - https://github.com/settings/tokens
   - Delete o token comprometido
   - Crie um novo

3. **Notifique a equipe:** Caso o repositório seja compartilhado

---

## Otimizações

### Cachear dependências no CI

Os workflows já usam `actions/setup-node@v3` com cache automático de `node_modules`.

```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '20'
    cache: 'npm' # ← cache automático
```

### Docker layer caching

O build Docker usa `actions/setup-buildx-action` que ativa cache de layers:

```yaml
- uses: docker/setup-buildx-action@v2
  with:
    driver-options: image=moby/buildkit:latest
```

Primeiro build é lento, próximos builds reutilizam layers.

---

## Links úteis

- [docs/gitflow.md](gitflow.md) — Branch flow (feature, hotfix, promotion)
- [docs/development.md](development.md) — Husky, desenvolvimento local
- [docs/docker-setup.md](docker-setup.md) — Docker Compose, infra
- [GitHub Actions docs](https://docs.github.com/en/actions)
- [act — Simular GitHub Actions localmente](https://github.com/nektos/act)
