# 🐳 Guia Completo: PostgreSQL + Node.js com Docker no Linux

Este guia mostra como subir o banco de dados PostgreSQL e a aplicação usando Docker Compose.

## ✅ Pré-requisitos

Verifique se tem instalado:

```bash
# Docker
docker --version
# Esperado: Docker version 20.10+

# Docker Compose
docker-compose --version
# Esperado: Docker Compose version 2.0+
```

Se não tiver, instale:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
# Logout e login novamente para ativar

# Fedora/RHEL
sudo dnf install docker docker-compose
sudo usermod -aG docker $USER
```

## 🚀 Passo 1: Configurar Variáveis de Ambiente

```bash
cd /home/felipecrl/Projetos/whatsapp-chatbot-imobiliaria

# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas chaves (nano, vim, ou editor visual)
nano .env
```

Preencha os campos obrigatórios:

```env
WHATSAPP_ACCESS_TOKEN=sua_chave_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_VERIFY_TOKEN=escolha_uma_senha
OPENAI_API_KEY=sua_chave_openai
```

## 🚀 Passo 2: Iniciar os Containers

```bash
# Subir PostgreSQL + Node.js em background
docker-compose up -d

# Ver status dos containers
docker-compose ps
```

Saída esperada:

```
NAME                        STATUS              PORTS
chatbot_imobiliaria_db      Up (healthy)        5432/tcp
chatbot_imobiliaria_app     Up                  0.0.0.0:3000->3000/tcp
```

## 📝 Passo 3: Acompanhar os Logs

```bash
# Ver logs da aplicação em tempo real
docker-compose logs -f app

# Ou só do banco de dados
docker-compose logs -f postgres

# Ver tudo
docker-compose logs -f

# Sair dos logs: Ctrl+C
```

Procure por mensagens como:

```
Servidor iniciado na porta 3000
Conexão com PostgreSQL estabelecida com sucesso
Todas as migrations executadas com sucesso
```

## ✔️ Passo 4: Verificar se Está Funcionando

```bash
# Teste o endpoint de saúde
curl http://localhost:3000/health

# Resposta esperada:
# {"status":"healthy",...}

# Se receber erro de conexão, aguarde alguns segundos e tente novamente
```

## 📊 Conectar ao Banco Diretamente (opcional)

```bash
# Acessar PostgreSQL dentro do container
docker-compose exec postgres psql -U chatbot_user -d chatbot_imobiliaria

# Dentro do psql, comandos úteis:
\dt                 # listar tabelas
SELECT * FROM conversations;  # ver conversas
\q                  # sair
```

Ou usar um cliente visual (pgAdmin, DBeaver):

```bash
# Host: localhost
# Port: 5432
# User: chatbot_user
# Password: chatbot_secure_password_123
# Database: chatbot_imobiliaria
```

## 🛑 Parar a Aplicação

```bash
# Parar containers (dados persistem no volume)
docker-compose down

# Parar e APAGAR dados do banco
docker-compose down -v

# Remover tudo (containers, volumes, imagens)
docker-compose down -v --rmi all
```

## 🔄 Reiniciar após Alterações

Se você modificar código ou variáveis:

```bash
# Recriar containers
docker-compose down
docker-compose up -d

# Ou simplemente:
docker-compose restart app
```

## 🐛 Troubleshooting Comum

### "Cannot connect to Docker daemon"

```bash
# Inicie o Docker
sudo systemctl start docker
# Ou no userland (sem sudo):
docker --version
```

### "Permission denied while trying to connect to Docker daemon"

```bash
sudo usermod -aG docker $USER
# Logout e login, ou:
newgrp docker
```

### "Port 3000 already in use"

```bash
# Ver qual processo usa a porta
lsof -i :3000
# Ou use outra porta no docker-compose.yml:
# ports:
#   - "3001:3000"
```

### "PostgreSQL container not healthy"

```bash
# Aguarde 10 segundos e verifique de novo
docker-compose ps

# Se persistir, ver logs
docker-compose logs postgres

# Reiniciar
docker-compose restart postgres
```

### "Cannot find .env file"

```bash
# Certifique-se que criou o arquivo no diretório correto
ls -la /home/felipecrl/Projetos/whatsapp-chatbot-imobiliaria/.env
# Deve existir. Se não:
cp .env.docker .env
```

## 📈 Monitorar Performance

```bash
# Ver uso de CPU/memória dos containers
docker stats

# Exemplo:
# CONTAINER    CPU %   MEM USAGE
# chatbot_app  0.5%    120MiB / 1GiB
# chatbot_db   2.1%    80MiB / 1GiB
```

## 💾 Backup do Banco de Dados

```bash
# Fazer dump do banco
docker-compose exec postgres pg_dump -U chatbot_user chatbot_imobiliaria > backup.sql

# Restaurar de um backup
cat backup.sql | docker-compose exec -T postgres psql -U chatbot_user chatbot_imobiliaria
```

## 🔐 Notas de Segurança

⚠️ **Para produção:**

- Mude a senha padrão em `docker-compose.yml`
- Use variáveis de ambiente seguras (AWS Secrets Manager, HashiCorp Vault)
- Não faça commit do `.env` real no Git (use `.env.example`)
- Configure HTTPS no nginx/proxy reverso
- Restricione acesso ao PostgreSQL (não exponha porta 5432)

## ✨ Próximas Etapas

1. **Configurar webhook no Meta**:
   - URL: `https://seu-dominio.com/webhook`
   - Token: mesmo de `WHATSAPP_VERIFY_TOKEN`

2. **Testar com client real**: Envie mensagem no WhatsApp para seu número

3. **Monitorar logs**: `docker-compose logs -f app`

4. **Adicionar métricas** (opcional): Prometheus, Datadog, etc.

---

**Dúvidas?** Verifique `README.md` ou `DOCKER_SETUP.md`.
