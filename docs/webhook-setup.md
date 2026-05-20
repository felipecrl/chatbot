# Configuração de Webhook

O chatbot suporta dois providers de WhatsApp, cada um com configuração de webhook diferente:

| Provider | Ambiente | Configuração                          |
| -------- | -------- | ------------------------------------- |
| `uazapi` | Dev      | Painel do uazapi.dev + ngrok          |
| `meta`   | Produção | Meta for Developers + domínio HTTPS   |

---

## uazapi — Desenvolvimento

O uazapi.dev oferece um plano gratuito que conecta um número WhatsApp real sem precisar de
servidor próprio. Ideal para desenvolvimento e testes.

### Pré-requisitos

- Conta em [uazapi.dev](https://uazapi.dev)
- [ngrok](https://ngrok.com) instalado localmente

### Passo a passo

**1. Criar instância no uazapi.dev**

- Acesse `https://uazapi.dev` → faça login → clique em "Nova Instância"
- Copie o **Instance Token** gerado
- Cole no `.env`:
  ```
  WHATSAPP_PROVIDER=uazapi
  UAZAPI_BASE_URL=https://free.uazapi.com
  UAZAPI_INSTANCE_TOKEN=SEU_TOKEN_AQUI
  ```

**2. Conectar o WhatsApp**

- No painel da instância, clique em "Conectar" → escaneie o QR code com o WhatsApp

> Instâncias do plano gratuito expiram após 1 hora de inatividade. Reconecte pelo painel quando
> necessário.

**3. Subir o app**

```bash
make dev-docker   # sobe postgres + app
# ou: npm run dev  (requer Postgres local)
```

**4. Expor o app com ngrok**

```bash
ngrok http 3000
```

Copie a URL `https://xxxxx.ngrok-free.app` exibida pelo ngrok.

**5. Configurar webhook no uazapi.dev**

- No painel da instância, clique em **"Configurar Webhook"**
- **URL:** `https://xxxxx.ngrok-free.app/webhook`
- **Eventos:** marque `messages`
- Salve

**6. Testar**

Envie uma mensagem de outro número WhatsApp para o número conectado na instância.
Acompanhe os logs:

```bash
make dev-logs
```

---

## Meta Cloud API — Produção

### Pré-requisitos

- Conta em [Meta for Developers](https://developers.facebook.com)
- App com produto WhatsApp Business configurado
- Domínio com HTTPS (o Caddy do `docker-compose.prod.yml` cuida disso automaticamente)

### Passo a passo

**1. Configurar credenciais no `.env`**

```
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=SEU_TOKEN
WHATSAPP_PHONE_NUMBER_ID=SEU_PHONE_ID
WHATSAPP_VERIFY_TOKEN=string-segura-qualquer
WHATSAPP_APP_SECRET=SEU_APP_SECRET   # recomendado em prod
```

> Em produção, `WHATSAPP_PROVIDER=meta` é imposto automaticamente pelo `docker-compose.prod.yml`
> mesmo que o `.env` indique outro valor.

**2. Subir o app em produção**

```bash
make prod-up
```

**3. Configurar webhook no Meta for Developers**

- Acesse `https://developers.facebook.com` → seu App → **WhatsApp → Webhook**
- **Callback URL:** `https://SEU_DOMINIO/webhook`
- **Verify Token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN` no `.env`
- Clique em **"Verificar e Salvar"**
- Marque o evento **`messages`** e salve

**4. Verificar**

```bash
# O Meta envia GET /webhook — o app responde com o hub.challenge
make prod-logs | grep -i webhook
```

Deve aparecer: `Webhook verificado pela Meta`

**5. Testar**

Envie uma mensagem para o número WhatsApp Business configurado.

---

## Variáveis de ambiente por provider

| Variável                  | `uazapi` (dev)  | `meta` (prod)  |
| ------------------------- | --------------- | -------------- |
| `WHATSAPP_PROVIDER`       | `uazapi`        | `meta`         |
| `UAZAPI_BASE_URL`         | obrigatório     | ignorado       |
| `UAZAPI_INSTANCE_TOKEN`   | obrigatório     | ignorado       |
| `WHATSAPP_ACCESS_TOKEN`   | ignorado        | obrigatório    |
| `WHATSAPP_PHONE_NUMBER_ID`| ignorado        | obrigatório    |
| `WHATSAPP_VERIFY_TOKEN`   | ignorado        | obrigatório    |
| `WHATSAPP_APP_SECRET`     | ignorado        | recomendado    |

---

## Problemas comuns

### "UAZAPI_INSTANCE_TOKEN is required"

Preencha `UAZAPI_INSTANCE_TOKEN` no `.env` com o token da instância no painel do uazapi.dev.

### "Webhook verification failed" (Meta)

Verifique se `WHATSAPP_VERIFY_TOKEN` no `.env` é exatamente igual ao campo "Verify Token"
configurado no Meta for Developers.

### App não recebe webhooks do uazapi

- Verifique se o ngrok está rodando: `ngrok http 3000`
- Confirme que a URL no painel do uazapi termina com `/webhook`
- URLs do ngrok gratuito mudam a cada reinicialização — atualize o painel após reiniciar o ngrok

### "Invalid access token" (Meta)

Gere um novo token permanente no Meta for Developers e atualize `WHATSAPP_ACCESS_TOKEN` no `.env`.
