# Docker — Guia de Uso

Este guia cobre como subir e gerenciar os containers Docker para os dois ambientes do projeto.

---

## Pré-requisitos

```bash
docker --version          # Docker 20.10+
docker compose version    # Docker Compose v2 (plugin, não docker-compose v1)
```

Se não tiver instalado (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker              # ativa o grupo sem precisar de logout
```

---

## Ambientes

| | Desenvolvimento | Produção |
|---|---|---|
| Comando | `make dev-docker` | `make prod-up` |
| Imagem | build local (Dockerfile) | pré-construída via CI (ghcr.io) |
| Banco | porta 5432 exposta no host | interno, sem exposição |
| HTTPS | não | sim (Caddy automático) |
| `NODE_ENV` | `development` | `production` |
| `USE_MOCK_AI` | `true` (padrão) | `false` |
| `SKIP_WHATSAPP_SEND` | `true` (padrão) | `false` |

---

## Desenvolvimento

### 1. Configurar variáveis

```bash
cp .env.example .env
# Os defaults do .env.example já são seguros para dev:
#   USE_MOCK_AI=true        → sem custo de API
#   SKIP_WHATSAPP_SEND=true → sem envio real ao WhatsApp
```

### 2. Subir os containers

```bash
make dev-docker        # sobe postgres + app em background
# ou: npm run compose:dev
```

### 3. Verificar status

```bash
docker compose ps
```

Saída esperada:

```
NAME                     STATUS           PORTS
chatbot_imobiliaria_db   Up (healthy)     0.0.0.0:5432->5432/tcp
chatbot_imobiliaria_app  Up (healthy)     0.0.0.0:3000->3000/tcp
```

### 4. Verificar saúde

```bash
curl http://localhost:3000/health
```

### 5. Acompanhar logs

```bash
make dev-logs          # segue os logs do app
docker compose logs -f # todos os containers
```

### 6. Reconstruir após alterar código

```bash
make dev-build         # força rebuild da imagem e reinicia
```

### 7. Derrubar

```bash
make dev-down          # preserva os dados do banco
docker compose down -v # destrói também o volume do banco
```

---

## Produção (manual)

O deploy em produção é feito automaticamente via CI/CD a cada push na `main`. Para subir
manualmente na Oracle VM:

```bash
# Na VM, certifique-se que o .env contém DOCKER_IMAGE=ghcr.io/USUARIO/REPO
make prod-up           # usa docker-compose.yml + docker-compose.prod.yml
# ou: npm run compose:prod
```

Para acompanhar:

```bash
make prod-logs
```

Para derrubar:

```bash
make prod-down
```

---

## Banco de dados

### Conectar ao PostgreSQL dentro do container

```bash
make dev-db-shell
# equivalente a: docker exec -it chatbot_imobiliaria_db psql -U chatbot_user -d chatbot_imobiliaria
```

Comandos psql úteis:

```sql
\dt                         -- listar tabelas
SELECT * FROM conversations; -- ver conversas
SELECT * FROM leads;         -- ver leads
\q                           -- sair
```

### Migrations

```bash
make migrate               # cria e aplica nova migration (dev)
# ou: npm run db:migrate

npm run db:deploy          # aplica migrations pendentes sem interação (usado no container em prod)
```

O container em produção aplica `prisma migrate deploy` automaticamente na inicialização.

### Prisma Studio

```bash
make studio                # abre interface web na porta 5555
# ou: npm run db:studio
```

### Backup e restore

```bash
# Backup
docker compose exec postgres pg_dump -U chatbot_user chatbot_imobiliaria > backup.sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U chatbot_user chatbot_imobiliaria
```

---

## Troubleshooting

### "Cannot connect to Docker daemon"

```bash
sudo systemctl start docker
```

### "Permission denied while trying to connect to Docker daemon"

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### "Permission denied" ao parar container criado com sudo

O container foi iniciado como root. Use `sudo docker compose down` desta vez. Nas próximas
execuções, use sempre sem `sudo` após adicionar o usuário ao grupo `docker`.

### "Port 3000 already in use"

```bash
lsof -i :3000             # ver qual processo usa a porta
```

Ou altere a porta no `.env`: `PORT=3001`

### "PostgreSQL container not healthy"

```bash
docker compose logs postgres
docker compose restart postgres
```

### Container do app reiniciando em loop

```bash
docker compose logs app   # ver o erro na inicialização
```

Causas comuns: variável obrigatória ausente no `.env`, banco ainda não disponível (aguarde o
healthcheck do postgres), erro de migration.

### Health check falha em produção

O health check em produção usa `docker inspect` (não depende de porta exposta):

```bash
docker inspect --format='{{.State.Health.Status}}' chatbot_imobiliaria_app
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 app
```

### P1000 — Authentication failed against database

As credenciais do `.env` não coincidem com o volume do Postgres inicializado anteriormente.
Recrie o volume:

```bash
docker compose down -v
docker compose up -d
```

---

## Monitorar uso de recursos

```bash
docker stats
```