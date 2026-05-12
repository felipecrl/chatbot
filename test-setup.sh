#!/bin/bash

# Script para validar a configuração do projeto

set -e

echo "🔍 Validando configuração do Chatbot..."
echo ""

# Verificar Docker
echo "1️⃣  Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não instalado"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

# Verificar Docker Compose
echo ""
echo "2️⃣  Verificando Docker Compose..."
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose: $(docker compose version)"
else
    echo "❌ Docker Compose não instalado"
    exit 1
fi

# Verificar Node.js
echo ""
echo "3️⃣  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não instalado (opcional para desenvolvimento)"
else
    echo "✅ Node.js: $(node --version)"
fi

# Verificar npm
echo ""
echo "4️⃣  Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm não instalado"
    exit 1
fi
echo "✅ npm: $(npm --version)"

# Verificar arquivos essenciais
echo ""
echo "5️⃣  Verificando arquivos do projeto..."
required_files=(
    ".env.example"
    "package.json"
    "docker-compose.yml"
    "Dockerfile"
    "src/index.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file não encontrado"
        exit 1
    fi
done

# Verificar .env
echo ""
echo "6️⃣  Verificando .env..."
if [ -f ".env" ]; then
    if grep -q "WHATSAPP_ACCESS_TOKEN=" .env; then
        echo "✅ .env existe e tem WHATSAPP_ACCESS_TOKEN"
    else
        echo "⚠️  .env existe mas WHATSAPP_ACCESS_TOKEN está vazio"
    fi
else
    echo "⚠️  .env não encontrado. Use: cp .env.docker .env"
fi

# Resumo
echo ""
echo "════════════════════════════════════════"
echo "✅ Configuração validada!"
echo "════════════════════════════════════════"
echo ""
echo "📋 Próximos passos:"
echo "1. Edite .env com suas chaves:"
echo "   nano .env"
echo ""
echo "2. Inicie os containers:"
echo "   docker-compose up -d"
echo ""
echo "3. Acompanhe os logs:"
echo "   docker-compose logs -f"
echo ""
echo "4. Verifique saúde:"
echo "   curl http://localhost:3000/health"
echo ""
