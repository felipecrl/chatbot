# 🌐 Guia Detalhado: Configurar Webhook no Meta for Developers

Este é um guia **passo a passo** para configurar o webhook do WhatsApp no Meta for Developers.

---

## 📋 O que você vai precisar

- ✅ Uma conta Meta (Facebook)
- ✅ Um App criado no Meta for Developers
- ✅ Acesso ao painel do seu App
- ✅ Um domínio HTTPS (seu servidor)
- ✅ O valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env`

---

## 🚀 Passo-a-Passo Completo

### ETAPA 1: Acessar Meta for Developers

**1. Abra no navegador:**

```
https://developers.facebook.com
```

**2. Clique em "Entrar" (Login)**

- Use sua conta Meta/Facebook
- Se não tiver, crie uma

**3. Você verá a página inicial com "Meus Apps"**

---

### ETAPA 2: Encontrar seu App

**1. No canto superior esquerdo, clique em "Meus Apps"**

```
┌─────────────────────┐
│  ☰ Meus Apps    ∨   │  ← Clique aqui
└─────────────────────┘
```

**2. Selecione seu App da lista**

- Se não tiver nenhum, crie um novo:
  - Clique em "Criar App"
  - Tipo: "Negócio" ou "App para consumidor"
  - Nome: "Chatbot Imobiliária" (ou qualquer nome)
  - Clique em "Criar"

**3. Você entrará no painel do seu App**

---

### ETAPA 3: Navegar até WhatsApp

**Dentro do painel do seu App:**

**Opção A: Se vir o menu lateral (esquerda)**

```
Menu esquerdo:
├── Dashboard
├── Aplicativos
├── Configuração
├── WhatsApp ← Procure aqui
│   ├── Primeiros passos
│   ├── Configuração ← CLIQUE AQUI
│   ├── Números de Telefone
│   └── Webhook
└── ...
```

**Opção B: Se não vir o menu, adicione WhatsApp:**

- Procure por "Adicionar Produto" ou "Add Product"
- Busque "WhatsApp"
- Clique em "Configurar"

---

### ETAPA 4: Ir para Webhook

**No menu lateral, clique em:**

```
WhatsApp → Webhook
```

OU se estiver em "Configuração", procure pela seção **"Webhook"** na página.

Você verá algo como:

```
═══════════════════════════════════════════
        CONFIGURAÇÃO DO WEBHOOK
═══════════════════════════════════════════

Callback URL:    [campo vazio ou URL anterior]
Verify Token:    [campo vazio]

            [Editar] ou [Verificar e Salvar]
```

---

### ETAPA 5: Preencher Callback URL

**1. Clique em "Editar" ou no campo "Callback URL"**

**2. Insira sua URL:**

```
https://seu-dominio.com/webhook
```

**Exemplos reais:**

```
https://chatbot-imobiliaria.com.br/webhook
https://meusite.com/webhook
https://66a8c1d5f4a3.ngrok.io/webhook  (se usar ngrok para teste)
```

⚠️ **IMPORTANTE:**

- Deve ser **HTTPS** (não HTTP)
- Deve ter `/webhook` no final
- Seu servidor deve estar **rodando e acessível**

---

### ETAPA 6: Preencher Verify Token

**1. No campo "Verify Token", insira:**

```
meu_token_secreto_aqui
```

⚠️ **ESTE TOKEN DEVE SER O MESMO DO SEU `.env`!**

Verifique seu `.env`:

```bash
cat .env | grep WHATSAPP_VERIFY_TOKEN
```

Você verá:

```
WHATSAPP_VERIFY_TOKEN=meu_token_secreto_aqui
```

**Copie exatamente este valor** e cole no Meta.

---

### ETAPA 7: Inscrever em Eventos

**1. Procure na página por "Campos de webhook" ou "Webhook Fields"**

Você verá algo como:

```
┌─────────────────────────────────────┐
│ Eventos de Webhook                  │
├─────────────────────────────────────┤
│ ☐ messages      (Mensagens)         │
│ ☐ message_reads (Mensagens Lidas)   │
│ ☐ status_updated (Status)           │
│ ☐ account_alerts (Alertas)          │
└─────────────────────────────────────┘
```

**2. Marque (✓) o checkbox:**

```
✓ messages
```

Este é o único que você precisa.

---

### ETAPA 8: Salvar

**1. Procure por um botão "Salvar", "Verificar e Salvar" ou "Save"**

**2. Clique nele**

O Meta vai:

- Fazer uma requisição GET para testar sua URL
- Verificar o Verify Token
- Salvar as configurações

---

## ✅ Como Saber se Funcionou

### Teste 1: Verificação do Meta (automática)

Ao clicar em Salvar, o Meta faz uma requisição GET:

```
GET https://seu-dominio.com/webhook?hub.mode=subscribe&hub.challenge=xxxx&hub.verify_token=seu_token
```

Seu servidor deve responder com:

```
xxxx
```

**Se vir mensagem de sucesso no Meta**, está OK! ✅

### Teste 2: Verificar Logs

Execute:

```bash
docker-compose logs app | grep -i webhook
```

Deve ver algo como:

```
Webhook verificado com sucesso pela Meta
```

### Teste 3: Enviar Mensagem Real

**1. Abra WhatsApp**

**2. Envie uma mensagem para o número do seu chatbot**

```
Cliente: "Olá"
```

**3. Acompanhe os logs:**

```bash
docker-compose logs -f app
```

Deve ver:

```
[timestamp] info: Mensagem recebida {"from":"55119999999","text":"Olá"}
```

**4. Se receber resposta no WhatsApp**, está funcionando! 🎉

---

## 🆘 Problemas Comuns e Soluções

### ❌ "Webhook verification failed"

**Causa 1: Token incorreto**

```
Verifique se o Verify Token do Meta é EXATAMENTE igual ao do .env
```

**Solução:**

```bash
# Ver token no .env
grep WHATSAPP_VERIFY_TOKEN .env

# Copie e cole no Meta novamente
```

**Causa 2: URL não está acessível**

```
Seu servidor não está rodando ou não é acessível do exterior
```

**Solução:**

```bash
# Verificar se está rodando
curl https://seu-dominio.com/health

# Se der erro, inicie:
docker-compose up -d
docker-compose logs -f app
```

**Causa 3: Domínio não tem HTTPS**

```
Meta só aceita HTTPS, não HTTP
```

**Solução:**

- Use um domínio com SSL/TLS válido
- Ou use **ngrok** para teste local:
  ```bash
  ngrok http 3000
  # Use a URL que ngrok gera (começa com https://)
  ```

---

### ❌ "No response from webhook"

**Causa: Seu servidor não responde**

**Solução:**

```bash
# Verificar se está rodando
docker-compose ps

# Se não está, inicie:
docker-compose up -d

# Aguarde 10 segundos e tente novamente
```

---

### ❌ "Invalid access token"

**Causa: Token do WhatsApp expirou ou está incorreto**

**Solução:**

```bash
# 1. Gere um novo token no Meta for Developers
# 2. Copie o novo token
# 3. Abra .env e substitua:
nano .env
# WHATSAPP_ACCESS_TOKEN=novo_token_aqui

# 4. Salve e reinicie:
docker-compose restart app
```

---

### ❌ "Mensagem recebida mas sem resposta"

**Causa: OpenAI API key inválida ou sem saldo**

**Solução:**

```bash
# 1. Verificar se OPENAI_API_KEY está preenchido:
grep OPENAI_API_KEY .env

# 2. Verifique saldo em:
# https://platform.openai.com/account/billing/overview

# 3. Se expirou, gere nova chave:
# https://platform.openai.com/api-keys

# 4. Atualize .env e reinicie:
docker-compose restart app
```

---

## 🔍 Verificação Final

**Checklist:**

- [ ] Consegui acessar Meta for Developers
- [ ] Encontrei meu App
- [ ] Fui em WhatsApp > Webhook
- [ ] Preenchi Callback URL (com seu domínio real)
- [ ] Preenchi Verify Token (igual ao .env)
- [ ] Marquei o checkbox "messages"
- [ ] Cliquei em Salvar
- [ ] Meta mostrou mensagem de sucesso
- [ ] Verifiquei logs: `docker-compose logs app`
- [ ] Testei enviando mensagem no WhatsApp
- [ ] Recebi resposta! ✅

---

## 📱 Resumo de URLs Importantes

| O que                   | URL                                  |
| ----------------------- | ------------------------------------ |
| **Meta for Developers** | https://developers.facebook.com      |
| **Seus Apps**           | https://developers.facebook.com/apps |
| **OpenAI API Keys**     | https://platform.openai.com/api-keys |
| **Seu Webhook**         | https://seu-dominio.com/webhook      |

---

## 💡 Dicas

**1. Se não tem domínio real:**

- Use **ngrok** para teste:
  ```bash
  ngrok http 3000
  # Copia a URL https:// gerada
  # Usa como Callback URL
  ```

**2. Se quer testar localmente:**

- Use ngrok (acima)
- OU configure port forwarding no router
- OU coloque em um servidor temporário

**3. Guarde bem:**

- ✅ WHATSAPP_ACCESS_TOKEN
- ✅ WHATSAPP_PHONE_NUMBER_ID
- ✅ WHATSAPP_VERIFY_TOKEN
- ✅ OPENAI_API_KEY

Não compartilhe essas chaves com ninguém!

---

Se tiver dúvida em alguma etapa, descreva exatamente onde está travado! 🚀
