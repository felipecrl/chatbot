# GitFlow e Branch Protection

Guia completo do fluxo de desenvolvimento com GitFlow neste projeto.

## Visão geral

Este projeto utiliza um **GitFlow com 3 ambientes protegidos**:

- **`develop`**: ambiente de integração contínua (destino para features e fixes)
- **`homolog`**: ambiente de homologação/staging (validação antes de produção)
- **`main`**: produção (deploy automático ao merge)

Cada ambiente possui regras de proteção, CI/CD obrigatório, e estratégia de merge específica.

---

## ⚠️ Regra Crítica: Nunca faça push direto para main/homolog/develop

**NUNCA execute:**

```bash
# ❌ ERRADO - vai quebrar o GitFlow
git push origin HEAD:main
git push origin HEAD:homolog
git push origin HEAD:develop
git push origin feature/xxx --force
```

**SEMPRE use PRs:**

```bash
# ✅ CORRETO - use PRs
git push origin feature/xxx
# ... GitHub Actions cria PR automaticamente via auto-pr.yml
# ... Você faz merge com Squash merge via GitHub
```

**Por que?**

- `main`, `homolog`, e `develop` têm branch protection rules
- Só PRs com CI aprovado podem fazer merge (squash merge apenas)
- Se você tentar push direto, vai ser **rejeitado** (ou requer bypass via --force, que está bloqueado)
- Se conseguir fazer bypass (força do admin), quebra a sincronização entre branches e causa **conflitos recorrentes**

Se acidentalmente fez push direto (ou force push):

1. **Revert**: Crie um PR com `git revert <commit>` para desfazer
2. Abra uma issue mencionando quais commits invadiram a branch protegida
3. Sincronize as branches via merge PR se necessário

---

## Convenção de branches

### Branches de trabalho

Sempre crie branches localmente a partir de `develop` (ou `main` para hotfixes):

| Tipo    | Padrão      | Base    | Descrição                    | Exemplo                    |
| ------- | ----------- | ------- | ---------------------------- | -------------------------- |
| Feature | `feature/*` | develop | Nova funcionalidade          | `feature/webhook-retry`    |
| Fix     | `fix/*`     | develop | Correção de bug              | `fix/conversation-timeout` |
| Hotfix  | `hotfix/*`  | main    | Correção crítica em produção | `hotfix/security-patch`    |

### Branches de longa vida (protegidas)

| Branch    | Propósito   | Protegida? | Merge strategy |
| --------- | ----------- | ---------- | -------------- |
| `main`    | Produção    | ✅ Sim     | Squash merge   |
| `homolog` | Homologação | ✅ Sim     | Squash merge   |
| `develop` | Integração  | ✅ Sim     | Squash merge   |

---

## Fluxo de desenvolvimento

### 1. Feature / Fix

```bash
# Atualize develop localmente
git checkout develop
git pull origin develop

# Crie a feature branch
git checkout -b feature/meu-recurso

# Desenvolva normalmente, commite como quiser
git commit -m "..."
git commit -m "..."

# Push dispara auto-pr.yml → cria PR para develop automaticamente
git push origin feature/meu-recurso
```

**O que acontece automaticamente:**

1. GitHub Actions dispara `auto-pr.yml`
2. Uma PR é criada automaticamente com seu branch → `develop`
3. A PR roda CI (lint, build, test) via `validate-pr.yml`

**Revisão e merge:**

- A PR aparece em `https://github.com/felipecrl/chatbot/pulls`
- Você (ou reviewers) aprovam o código
- Merge com **Squash merge** (compacta todos os commits em um)
- Branch é deletada automaticamente

### 2. Promoção: Develop → Homolog

Quando você faz merge de uma PR em `develop`, `promote.yml` dispara automaticamente:

```
develop merge ↓
[promote.yml]
    ↓
Cria PR develop → homolog
    ↓
CI + Docker build test
    ↓
Aprovação manual necessária
    ↓
Merge em homolog
```

**Você não faz nada** — a promoção é automática. Apenas aprove a PR de promoção em `homolog`.

### 3. Promoção: Homolog → Main (Produção)

Quando merge acontece em `homolog`, `promote.yml` cria uma PR para `main`:

```
homolog merge ↓
[promote.yml]
    ↓
Cria PR homolog → main
    ↓
CI + requer 1 reviewer
    ↓
Aprovação necessária
    ↓
Merge em main → Deploy automático
```

Ao fazer merge em `main`, o workflow `deploy-production.yml` dispara automaticamente.

### 4. Hotfix (Caminho direto para produção)

Para correções críticas que não podem esperar a promoção normal:

```bash
# Crie a hotfix branch a partir de main
git checkout main
git pull origin main
git checkout -b hotfix/correcao-critica

# Desenvolva e commit
git commit -m "..."

# Push dispara auto-pr.yml
git push origin hotfix/correcao-critica
```

**O que acontece:**

1. `auto-pr.yml` detecta `hotfix/*` e cria PR para `main` (não para develop)
2. PR recebe label automático: `hotfix`
3. CI roda normalmente
4. Após merge em main → deploy automático
5. `promote.yml` detecta a label `hotfix` e cria **backport automático** para develop

Fluxo visual:

```
hotfix/xxx
    ↓
PR → main (label: hotfix)
    ↓
CI + revisão manual
    ↓
Merge em main → Deploy ✅
    ↓
[promote.yml] → backport automático para develop
```

---

## Regras de proteção de branch

### Develop

```
✅ Require status checks to pass: Yes
   └─ ci / Lint · Type · Build · Test
✅ Require branches to be up to date: Yes
✅ Require code reviews: No
✅ Require PR before merge: Yes
✅ Allow squash merging: Yes
✅ Allow rebase merging: No
✅ Require signed commits: No
✅ Auto-delete head branches: Yes (após merge)
```

### Homolog

```
✅ Require status checks to pass: Yes
   ├─ ci / Lint · Type · Build · Test
   └─ ci / Docker Build Test
✅ Require branches to be up to date: Yes
✅ Require code reviews: No
✅ Require PR before merge: Yes
✅ Allow squash merging: Yes
✅ Allow rebase merging: No
✅ Require signed commits: No
✅ Auto-delete head branches: Yes
```

### Main (Produção)

```
✅ Require status checks to pass: Yes
   ├─ ci / Lint · Type · Build · Test
   └─ ci / Docker Build Test
✅ Require branches to be up to date: Yes
✅ Require code reviews: Yes (1 reviewer)
✅ Require PR before merge: Yes
✅ Allow squash merging: Yes
✅ Allow rebase merging: No
✅ Require signed commits: No
✅ Auto-delete head branches: Yes
```

---

## Configuração inicial

As regras de proteção e ambientes são configuradas automaticamente via script:

```bash
# Certifique-se de ter um PAT com escopo repo + read:org
export GH_TOKEN=ghp_xxxxxxxxxxxx

# Execute o script de setup
./scripts/setup-branch-protection.sh
```

O script:

- Cria/configura labels (`hotfix`, `backport`)
- Configura GitHub Environments (`production`, `homolog`)
- Define branch protection rules
- Configura merge settings (squash only)

---

## Fluxo visual completo

```
┌─────────────────────────────────────────────────────────────┐
│                      LOCAL DEVELOPMENT                      │
└─────────────────────────────────────────────────────────────┘

git checkout -b feature/xxx origin/develop
   ↓ [código] ↓
git push origin feature/xxx
   ↓
┌─────────────────────────────────────────────────────────────┐
│                   AUTO PR + CI VALIDATION                   │
│   (auto-pr.yml cria PR, validate-pr.yml roda CI)           │
└─────────────────────────────────────────────────────────────┘
   ↓ [review + approve] ↓
[MERGE SQUASH em develop]
   ↓
┌─────────────────────────────────────────────────────────────┐
│              PROMOTE: develop → homolog (AUTO)              │
│  (promote.yml cria PR, CI + Docker build test)             │
└─────────────────────────────────────────────────────────────┘
   ↓ [review + approve] ↓
[MERGE SQUASH em homolog]
   ↓
┌─────────────────────────────────────────────────────────────┐
│              PROMOTE: homolog → main (AUTO)                 │
│     (promote.yml cria PR, CI + 1 reviewer requerido)       │
└─────────────────────────────────────────────────────────────┘
   ↓ [review + approve] ↓
[MERGE SQUASH em main]
   ↓
┌─────────────────────────────────────────────────────────────┐
│                   DEPLOY AUTOMÁTICO (CI)                    │
│   (deploy-production.yml: CI → Docker build → Deploy SSH)   │
└─────────────────────────────────────────────────────────────┘
   ↓
✅ LIVE EM PRODUÇÃO
```

---

## Troubleshooting

### "PR não foi criada automaticamente"

- Verifique se o token `GH_PAT` foi configurado com escopo `repo` + `read:org`
- Verifique se as branches estão no padrão: `feature/*`, `fix/*`, `hotfix/*`
- Procure em "Actions" para logs de erro do `auto-pr.yml`

### "Promoção não aconteceu"

- Verifique se a branch anterior foi mergeada com squash (não rebase/merge commit)
- Procure em "Actions" para logs do `promote.yml`

### "CI falhou no PR"

- Rode localmente: `npm run lint && npm run build && npm test`
- Certifique-se de que os arquivos foram formatados (Husky deve ter feito isso no commit)
- Se o problema persistir, verifique os logs do GitHub Actions

### "As branches main/homolog estão desincronizadas com conflitos recorrentes"

**Sintoma:** Toda vez que cria uma PR de promoção (develop → homolog ou homolog → main), aparece "merge conflicts" mesmo sem mudanças recentes.

**Causa raiz:** Alguém fez push direto para `main` ou `homolog` (ou force push), quebrando a sequência GitFlow.

**Exemplo de o que aconteceu:**

```
develop ──→ (PR #1) ──→ homolog ──→ (PR #2) ──→ main
                                         ↑
                    Alguém fez push direto aqui (ou force push)
                    quebrando a sincronização
```

**Solução:**

1. Crie um branch de merge a partir de origin/main:

   ```bash
   git checkout -B merge-XXX origin/main
   ```

2. Merge a branch "correta" (com as melhorias) usando estratégia `-X theirs`:

   ```bash
   git merge -X theirs origin/homolog -m "chore: sync branches"
   ```

3. Push e crie PR:

   ```bash
   git push -u origin merge-XXX
   gh pr create --title "Fix branch sync" --body "..."
   ```

4. Após merge dessa PR, as branches estarão sincronizadas novamente.

5. **PREVENÇÃO:** Certifique-se de que `enforce_admins: true` está ativado no branch protection (setup-branch-protection.sh o faz automaticamente).

### "Quero abortar / deletar a branch"

Depois do merge, a branch é deletada automaticamente. Se precisar deletar manualmente:

```bash
git branch -d feature/xxx              # local
git push origin --delete feature/xxx   # remota
```

---

## Links úteis

- [docs/development.md](development.md) — Husky, hooks, desenvolvimento local
- [docs/ci-cd.md](ci-cd.md) — Detalhes dos workflows de CI/CD e deploy
- [docs/docker-setup.md](docker-setup.md) — Docker Compose e troubleshooting
