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

create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null && \
    echo "  ✓ Label '${name}' criada" || echo "  ~ Label '${name}' já existe"
}

create_environment() {
  local env_name="$1"
  echo "→ Criando environment: ${env_name}"
  gh api \
    --method PUT \
    "/repos/${REPO}/environments/${env_name}" > /dev/null 2>&1 || true
  echo "  ✓ Environment '${env_name}' pronto"
}

# Nomes dos checks detectados automaticamente via:
# gh api repos/felipecrl/chatbot/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[].name'

protect_branch() {
  local branch="$1"
  local context_1="$2"
  local context_2="$3"
  local require_review="${4:-false}"

  echo "→ Configurando proteção para branch: ${branch}"

  # Constrói o array de contexts
  local contexts_json="[\"${context_1}\""
  if [ -n "$context_2" ]; then
    contexts_json="${contexts_json}, \"${context_2}\""
  fi
  contexts_json="${contexts_json}]"

  # Constrói o payload
  local review_rules="null"
  if [ "$require_review" = "true" ]; then
    review_rules='{
      "dismiss_stale_reviews": true,
      "required_approving_review_count": 1
    }'
  fi

  gh api \
    --method PUT \
    "/repos/${REPO}/branches/${branch}/protection" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${contexts_json}
  },
  "enforce_admins": true,
  "required_pull_request_reviews": ${review_rules},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
  echo "  ✓ Branch ${branch} protegida"
}

# ── Main ───────────────────────────────────────────────────────────────────────

echo "=== Criando Labels ==="
create_label "hotfix"  "e11d48" "Hotfix urgente — caminho direto para produção"
create_label "backport" "7c3aed" "Backport automático de hotfix"
echo ""

echo "=== Criando GitHub Environments ==="
create_environment "production"
create_environment "homolog"
echo ""

echo "=== Check Names ==="
CHECK_LINT="ci / Lint · Type · Build · Test"
CHECK_DOCKER="ci / Docker Build Test"
echo "  1. ${CHECK_LINT}"
echo "  2. ${CHECK_DOCKER}"
echo ""

echo "=== Configurando Branch Protection ==="

# develop: requer CI básico, sem reviewer
protect_branch "develop" "${CHECK_LINT}" "" "false"

# homolog: requer CI + docker-build, sem reviewer
protect_branch "homolog" "${CHECK_LINT}" "${CHECK_DOCKER}" "false"

# main: requer CI + docker-build + 1 reviewer obrigatório
protect_branch "main" "${CHECK_LINT}" "${CHECK_DOCKER}" "true"

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
echo "✅ Setup concluído!"
