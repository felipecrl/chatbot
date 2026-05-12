# 🌐 Teste Completo Local com ngrok

Guia para testar **tudo localmente** sem precisar de servidor real.

---

## 📋 O que é ngrok?

**ngrok** cria um túnel HTTPS público para seu servidor local.

```
Seu PC (localhost:3000)
        ↓
    [ngrok]
        ↓
https://abc123.ngrok.io (URL pública)
        ↓
Meta WhatsApp pode acessar
```

---

## 🚀 Instalação do ngrok

### Linux/Mac

**Opção 1: Baixar direto**
```bash
# Baixar
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip

# Descompactar
unzip ngrok-v3-stable-linux-amd64.zip

# Mover para /usr/local/bin
sudo mv ngrok /usr/local/bin/

# Verificar
ngrok --version
```

**Opção 2: Usando apt (Ubuntu/Debian)**
```bash
# Instalar
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok

# Verificar
ngrok --version
```

### Windows
- Baixe em: https://ngrok.com/download
- Descompacte em uma pasta
- Abra cmd/PowerShell e navegue até a pasta

---

## 🔑 Configurar ngrok (Uma Vez)

**1. Vá para:** https://ngrok.com/
**2. Clique em "Sign Up" ou "Log In"**
**3. Copie seu Auth Token** (você receberá um)
**4. Execute:**
```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

---

## ▶️ Iniciar ngrok (Para Cada Teste)

### Terminal 1: Inicie o ngrok
```bash
ngrok http 3000
```

Você verá algo assim:
```
Session Status                online
Account                       seu-email@gmail.com
Version                       3.3.0
Region                        us (United States)
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:3000

Connections                   ttl    opn    rt1    rt5    p50     p95
                              0      0      0.00   0.00   0.00    0.00

Web Interface                 http://127.0.0.1:4040
```

⚠️ **COPIE ESTA URL:**
```
https://abc123def456.ngrok.io
```

---

## 🐳 Terminal 2: Docker (em outro terminal)

```bash
# Verifique se está rodando
docker-compose ps

# Se não estiver, inicie:
docker-compose up -d

# Veja logs
docker-compose logs -f app
```

---

## 📝 Terminal 3: Configure o .env

```bash
# Abra o .env
nano .env
```

**Preencha com os valores reais:**
```env
# Sua chave OpenAI real
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx

# Seu token WhatsApp real
WHATSAPP_ACCESS_TOKEN=EABC...

# Seu ID de número WhatsApp real
WHATSAPP_PHONE_NUMBER_ID=1234567890

# Token de verificação (você escolhe)
WHATSAPP_VERIFY_TOKEN=meu_token_secreto_aqui
```

**Salve:** Ctrl+X → Y → Enter

**Reinicie o app:**
```bash
docker-compose restart app

# Aguarde 10 segundos
sleep 10

# Verifique
curl http://localhost:3000/health
```

---

## 🌐 Configure o Webhook no Meta

**1. Abra:** https://developers.facebook.com

**2. Vá em:** Seu App → WhatsApp → Webhook

**3. Preencha:**

| Campo | Valor |
|-------|-------|
| **Callback URL** | `https://abc123def456.ngrok.io/webhook` |
| **Verify Token** | `meu_token_secreto_aqui` |

**Use a URL do ngrok!** (de Terminal 1)

**4. Marque o checkbox:**
```
✓ messages
```

**5. Clique em Salvar**

Meta vai testar. Se der OK, está configurado! ✅

---

## 📱 Teste a Aplicação

### Teste 1: Webhook Funciona

**No Terminal 3:**
```bash
# Testar a URL do ngrok
curl https://abc123def456.ngrok.io/health
```

**Esperado:**
```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "whatsapp": "configured",
    "openai": "configured"
  }
}
```

### Teste 2: Enviar Mensagem Real no WhatsApp

**1. Abra WhatsApp**

**2. Envie mensagem para o número do seu chatbot:**
```
"Olá, procuro um apartamento"
```

**3. Acompanhe os logs (Terminal 2):**
```bash
docker-compose logs -f app
```

**Você deve ver:**
```
[timestamp] info: Mensagem recebida {"from":"5511999999999","text":"Olá, procuro um apartamento"}
[timestamp] info: Enviando para GPT-4...
[timestamp] info: Resposta enviada
```

**4. Aguarde 5-10 segundos**

**5. Você receberá resposta no WhatsApp!** 🎉

---

## 🔄 Fluxo Completo de Teste

```
1️⃣  Terminal 1: ngrok http 3000
         ↓
2️⃣  Terminal 2: docker-compose logs -f app
         ↓
3️⃣  Terminal 3: Abra navegador → Meta for Developers
         ↓
4️⃣  Configure Webhook com URL do ngrok
         ↓
5️⃣  Meta testa e aprova
         ↓
6️⃣  Abra WhatsApp
         ↓
7️⃣  Envie mensagem para seu chatbot
         ↓
8️⃣  Veja resposta chegar! 🎉
         ↓
9️⃣  Acompanhe logs em Terminal 2
```

---

## 🆘 Problemas Comuns

### ❌ "Webhook verification failed"

**Verifique:**
1. A URL do ngrok está correta (Terminal 1)?
2. O Verify Token é igual ao `.env`?
3. O app está rodando (Terminal 2)?

```bash
# Teste manual
curl "https://abc123def456.ngrok.io/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=meu_token_secreto_aqui"
```

**Esperado:** `test`

### ❌ "ngrok não funciona"

**Solução:**
```bash
# Reinstale
ngrok --version

# Se erro, faça:
ngrok authtoken SEU_TOKEN
ngrok http 3000
```

### ❌ "Mensagem chega mas sem resposta"

**Verifique logs:**
```bash
docker-compose logs app | grep -i error
```

**Possíveis causas:**
- OPENAI_API_KEY inválida ou sem saldo
- WHATSAPP_ACCESS_TOKEN expirado
- Banco de dados desconectado

**Solução:**
```bash
# Reiniciar tudo
docker-compose down
docker-compose up -d
sleep 10
docker-compose logs app
```

### ❌ "ngrok URL muda cada vez que reinicio"

**Normal!** ngrok gera nova URL a cada execução.

**Solução:**
- Quando reiniciar ngrok, copie a nova URL
- Atualize o Webhook no Meta com a nova URL

---

## 💡 Dicas Profissionais

### 1️⃣ **Manter URL ngrok Fixa (Opcional)**
```bash
# Com conta paga do ngrok
ngrok http 3000 --domain seu-dominio.ngrok.io
```

### 2️⃣ **Ver Requisições do ngrok**
Abra: `http://127.0.0.1:4040`

Você vê todas as requisições que passam pelo ngrok.

### 3️⃣ **Testar Webhook Manualmente**
```bash
curl -X POST https://abc123def456.ngrok.io/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.123",
            "from": "5511999999999",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Teste local"
            }
          }],
          "contacts": [{
            "profile": {
              "name": "Cliente Teste"
            }
          }]
        }
      }]
    }]
  }'
```

### 4️⃣ **Múltiplos Testes em Paralelo**
```bash
# Terminal 1
ngrok http 3000

# Terminal 2
docker-compose logs -f app

# Terminal 3
watch -n 1 'curl -s http://localhost:3000/health | jq .'

# Terminal 4
# Abra WhatsApp e teste
```

---

## 📋 Checklist de Teste Local

- [ ] ngrok instalado e configurado
- [ ] ngrok rodando: `ngrok http 3000`
- [ ] Docker rodando: `docker-compose up -d`
- [ ] .env preenchido com chaves reais
- [ ] `curl http://localhost:3000/health` retorna "healthy"
- [ ] `curl https://abc123def456.ngrok.io/health` retorna "healthy"
- [ ] Webhook configurado no Meta com URL do ngrok
- [ ] Meta aprovou o webhook (sem erro)
- [ ] Enviei mensagem no WhatsApp
- [ ] Recebi resposta automática! ✅
- [ ] Logs mostram tudo correto

---

## 🎯 Próximo Passo

Depois de testar tudo localmente com sucesso:

1. **Pegue um servidor real** (AWS, DigitalOcean, Heroku, etc)
2. **Coloque o domínio do servidor** no Webhook do Meta
3. **Deploy do projeto** para o servidor
4. **Teste novamente** com o domínio real

Mas antes disso, certifique-se de que funciona localmente! 🚀

---

## 📚 Links Úteis

- **ngrok**: https://ngrok.com
- **Meta for Developers**: https://developers.facebook.com
- **OpenAI API**: https://platform.openai.com
- **WhatsApp Docs**: https://developers.facebook.com/docs/whatsapp

---

**Ficou claro? Você já tem ngrok instalado?**
