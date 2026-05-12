# ⚡ Quick Start - Docker + PostgreSQL no Linux

## 1️⃣ Validar Ambiente

```bash
./test-setup.sh
```

Deve retornar:
```
✅ Configuração validada!
```

## 2️⃣ Configurar Variáveis (uma única vez)

```bash
cp .env.example .env
```

Edite `.env` e preencha **obrigatoriamente**:
```bash
nano .env
```

Campos obrigatórios:
```env
WHATSAPP_ACCESS_TOKEN=sua_chave_meta_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_numero_id_aqui
WHATSAPP_VERIFY_TOKEN=qualquer_senha_aqui
OPENAI_API_KEY=sua_chave_openai_aqui
```

## 3️⃣ Subir Banco + App (2 comandos)

```bash
# Subir tudo em background
docker-compose up -d

# Aguardar 5 segundos e verificar
sleep 5 && curl http://localhost:3000/health
```

Pronto! 🎉

## 📊 Monitorar

```bash
# Ver logs em tempo real
docker-compose logs -f app

# Ver status dos containers
docker-compose ps

# Parar quando quiser
docker-compose down
```

## 🔗 Configurar Webhook no WhatsApp

1. Acesse [Meta for Developers](https://developers.facebook.com)
2. App > WhatsApp > Configuração > Webhook
3. Configure:
   - **Callback URL**: `https://seu-dominio.com/webhook`
   - **Verify Token**: mesmo valor de `WHATSAPP_VERIFY_TOKEN`
   - **Objetos**: `messages`

## ✅ Testar

```bash
# Saúde do sistema
curl http://localhost:3000/health

# Conectar ao banco de dados
docker-compose exec postgres psql -U chatbot_user -d chatbot_imobiliaria -c "SELECT COUNT(*) FROM conversations;"

# Ver logs de erro
docker-compose logs app | grep -i error
```

## 📖 Documentação Completa

- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** — Guia detalhado com troubleshooting
- **[README.md](README.md)** — Documentação do projeto
- **[.env.example](.env.example)** — Todas as variáveis disponíveis

## 🆘 Algo deu errado?

```bash
# Ver logs do banco
docker-compose logs postgres

# Reiniciar tudo
docker-compose restart

# Apagar e recomeçar (cuidado: perde dados!)
docker-compose down -v
docker-compose up -d
```

---

Dúvidas? Veja [DOCKER_SETUP.md](DOCKER_SETUP.md#-troubleshooting-comum).
