#!/bin/bash

# Script para rodar todos os testes locais

set -e

echo "🧪 Executando suite de testes locais...\n"
echo "═════════════════════════════════════════════════════════════"

# Verificar se o banco está rodando
echo "\n1️⃣  Verificando PostgreSQL..."
if ! docker-compose ps postgres | grep -q "healthy"; then
  echo "⚠️  PostgreSQL não está saudável. Iniciando..."
  docker-compose up -d postgres
  sleep 10
fi
echo "✅ PostgreSQL está rodando"

# Rodar migrations
echo "\n2️⃣  Rodando migrations..."
npm run migrate > /dev/null 2>&1
echo "✅ Migrations executadas"

# Teste 1: Modelo de conversa
echo "\n3️⃣  Teste 1: Modelo de Conversa"
echo "   Testando CRUD de conversas no PostgreSQL..."
node test-conversation.js
echo ""

# Teste 2: Busca de imóveis
echo "4️⃣  Teste 2: Busca de Imóveis"
echo "   Testando dados simulados de imóveis..."
node test-imoveis.js
echo ""

# Teste 3: E2E
echo "5️⃣  Teste 3: Fluxo Ponta-a-Ponta (E2E)"
echo "   Simulando conversa completa com cliente..."
node test-e2e.js
echo ""

echo "═════════════════════════════════════════════════════════════"
echo "\n✨ Todos os testes passaram com sucesso!\n"
echo "📊 Resultados:"
echo "   ✅ Banco de dados funcionando"
echo "   ✅ Modelo de conversas operacional"
echo "   ✅ Busca de imóveis funcionando"
echo "   ✅ Fluxo E2E completo"
echo ""
echo "🚀 Próximos passos:"
echo "   1. Configure as chaves de API no .env"
echo "   2. Configure o webhook no Meta for Developers"
echo "   3. Envie uma mensagem de teste via WhatsApp"
echo ""
