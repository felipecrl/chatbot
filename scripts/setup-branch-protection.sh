#!/usr/bin/env bash
# Configura branch protection rules e GitHub Environments para o GitFlow.
# Pré-requisitos:
#   - gh CLI instalado e autenticado (gh auth login)
#   - Ao menos um workflow já executado (para os check names existirem no GitHub)
#
# Uso:
#   chmod +x scripts/setup-branch-protection.sh
#   ./scripts/setup-branch-protection.sh

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Repositório: ${REPO}"
echo ""

# ── Helpers ────────────────────────────────────────────────────────────────────

protect_branch() {
  local branch="$1"
  local payload="$2"
  echo "→ Configurando proteção: ${branch}"
  gh api \
    --method PUT \
    "/repos/${REPO}/branches/${branch}/protection" \
    --input - <<< "$payload"
  echo "  ✓ ${branch} protegida"
}

create_environment() {
  local env_name="$1"
  echo "→ Criando environment: ${env_name}"
  gh api \
    --method PUT \
    "/repos/${REPO}/environments/${env_name}" > /dev/null 2>&1 || true
  echo "  ✓ Environment '${env_name}' pronto"
}

# ── Environments ───────────────────────────────────────────────────────────────
echo "=== Criando Labels ==="
create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null && \
    echo "  ✓ Label '${name}' criada" || echo "  ~ Label '${name}' já existe"
}
create_label "hotfix"  "e11d48" "Hotfix urgente — caminho direto para produção"
create_label "backport" "7c3aed" "Backport automático de hotfix"
echo ""

echo "=== Criando GitHub Environments ==="
create_environment "production"
create_environment "homolog"
echo ""

# ── Branch Protection ──────────────────────────────────────────────────────────
# ATENÇÃO: Os "contexts" abaixo correspondem aos nomes de status check que
# aparecem no GitHub após a primeira execução dos workflows. Se os nomes
# divergirem, ajuste aqui.
#
# Padrão GitHub Actions: "Workflow Name / Job Name"
# Para reusable workflows: "Workflow Name / reusable-job-name"
#
# Nomes esperados com base nos workflows criados:
#   Validate PR / validate          → job 'validate' do reusable-ci.yml
#   Validate PR / docker-build      → job 'docker-build' do reusable-ci.yml

echo "=== Configurando Branch Protection ==="

# develop: requer CI básico, sem reviewer
protect_branch "develop" '{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Validate PR / validate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}'

# homolog: requer CI + docker-build, sem reviewer
protect_branch "homolog" '{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Validate PR / validate",
      "Validate PR / docker-build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}'

# main: requer CI + docker-build + 1 reviewer obrigatório
protect_branch "main" '{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Validate PR / validate",
      "Validate PR / docker-build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}'

echo ""
echo "=== Configurações de Merge ==="
echo "Habilitando apenas Squash Merge no repositório..."
gh api \
  --method PATCH \
  "/repos/${REPO}" \
  --field "allow_squash_merge=true" \
  --field "allow_merge_commit=false" \
  --field "allow_rebase_merge=false" \
  --field "squash_merge_commit_title=PR_TITLE" \
  --field "squash_merge_commit_message=PR_BODY" \
  --field "delete_branch_on_merge=true" > /dev/null
echo "  ✓ Squash merge habilitado, outros desabilitados"
echo "  ✓ Delete branch on merge habilitado"

echo ""
echo "=== Próximos passos manuais ==="
echo ""
echo "1. Crie um Personal Access Token (PAT) em:"
echo "   https://github.com/settings/tokens/new"
echo "   Escopo necessário: repo (Full control of private repositories)"
echo ""
echo "2. Adicione o PAT como secret no repositório:"
echo "   Nome: GH_PAT"
echo "   https://github.com/${REPO}/settings/secrets/actions/new"
echo ""
echo "3. Migre os secrets existentes para o Environment 'production':"
echo "   ORACLE_SSH_KEY  → renomear para PROD_SSH_KEY"
echo "   ORACLE_VM_IP    → renomear para PROD_VM_IP"
echo "   ORACLE_VM_USER  → renomear para PROD_VM_USER"
echo "   Em: https://github.com/${REPO}/settings/environments/production"
echo ""
echo "4. Para o ambiente de homologação (quando disponível), adicionar ao"
echo "   Environment 'homolog': HOMOLOG_SSH_KEY, HOMOLOG_VM_IP, HOMOLOG_VM_USER"
echo ""
echo "✅ Setup concluído!"
