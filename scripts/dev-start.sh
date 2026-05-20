#!/usr/bin/env bash
# Inicia o ambiente de desenvolvimento completo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "  $*"; }
ok()   { echo "  ✓ $*"; }
warn() { echo "  ! $*"; }

get_env() {
  grep -E "^${1}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'
}

# ── 1. Garante .env ───────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
echo "  Chatbot Imobiliária — Dev Start"
echo "════════════════════════════════════════════"
echo ""

if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env criado a partir de .env.example."
  warn "Revise as variáveis (especialmente WHATSAPP_PROVIDER) e rode novamente."
  echo ""
  exit 0
fi

# ── 2. Lê configurações do .env ───────────────────────────────────────────────

PROVIDER=$(get_env WHATSAPP_PROVIDER); PROVIDER="${PROVIDER:-meta}"
APP_PORT=$(get_env PORT);              APP_PORT="${APP_PORT:-3000}"

log "Provider:  $PROVIDER"
log "App port:  $APP_PORT"
echo ""

# ── 3. Sobe os containers ─────────────────────────────────────────────────────

log "Iniciando containers..."
docker compose up -d --build --remove-orphans

# ── 4. Resumo final ───────────────────────────────────────────────────────────

echo ""
ok "Containers iniciados."
ok "App:     http://localhost:${APP_PORT}"
ok "Health:  http://localhost:${APP_PORT}/health"
ok "Webhook: http://localhost:${APP_PORT}/webhook"

if [ "$PROVIDER" = "uazapi" ]; then
  echo ""
  log "Provider: uazapi (dev) — exponha o app com ngrok para receber webhooks:"
  log "  ngrok http ${APP_PORT}"
  log "  Em seguida, configure a URL de webhook no painel do uazapi."
fi

echo ""
