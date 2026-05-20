.PHONY: help start stop \
        dev dev-docker dev-down dev-logs dev-build dev-db-shell \
        prod-up prod-down prod-logs prod-restart \
        migrate studio test lint build

# ── Ajuda ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  COMANDOS PRINCIPAIS"
	@echo "    make start               setup completo: garante .env e sobe os containers"
	@echo "    make stop                derruba todos os containers"
	@echo ""
	@echo "  DESENVOLVIMENTO LOCAL (sem Docker)"
	@echo "    make dev            tsx watch — hot-reload, requer Postgres local ou dev-docker"
	@echo ""
	@echo "  DESENVOLVIMENTO (Docker Compose — controle granular)"
	@echo "    make dev-docker          sobe postgres + app"
	@echo "    make dev-down            derruba os containers de dev"
	@echo "    make dev-logs            segue os logs do app"
	@echo "    make dev-build           reconstrói a imagem e sobe"
	@echo "    make dev-db-shell        abre psql dentro do container do Postgres"
	@echo ""
	@echo "  PRODUÇÃO (Oracle VM — rodar localmente só para testes)"
	@echo "    make prod-up        sobe com overrides de prod (requer DOCKER_IMAGE no .env)"
	@echo "    make prod-down      derruba os containers de prod"
	@echo "    make prod-logs      segue os logs do app em prod"
	@echo "    make prod-restart   recria containers sem rebuildar a imagem"
	@echo ""
	@echo "  BANCO DE DADOS"
	@echo "    make migrate        cria e aplica nova migration (dev)"
	@echo "    make studio         abre o Prisma Studio no navegador"
	@echo ""
	@echo "  QUALIDADE"
	@echo "    make test           roda a suíte de testes"
	@echo "    make lint           verifica lint e formatação"
	@echo "    make build          compila TypeScript para dist/"
	@echo ""

# ── Comandos principais ───────────────────────────────────────────────────────
start:
	@bash scripts/dev-start.sh

stop:
	docker compose down

# ── Dev local (sem Docker) ─────────────────────────────────────────────────────
dev:
	npm run dev

# ── Dev (Docker Compose) ──────────────────────────────────────────────────────
dev-docker:
	docker compose up -d

dev-down:
	docker compose down

dev-logs:
	docker compose logs -f app

dev-build:
	docker compose up -d --build

dev-db-shell:
	docker exec -it chatbot_imobiliaria_db psql -U $${POSTGRES_USER:-chatbot_user} -d $${POSTGRES_DB:-chatbot_imobiliaria}

# ── Produção ──────────────────────────────────────────────────────────────────
PROD_COMPOSE = docker compose -f docker-compose.yml -f docker-compose.prod.yml

prod-up:
	$(PROD_COMPOSE) up -d

prod-down:
	$(PROD_COMPOSE) down

prod-logs:
	$(PROD_COMPOSE) logs -f app

prod-restart:
	$(PROD_COMPOSE) up -d --no-build --remove-orphans

# ── Banco de dados ────────────────────────────────────────────────────────────
migrate:
	npm run db:migrate

studio:
	npm run db:studio

# ── Qualidade ─────────────────────────────────────────────────────────────────
test:
	npm test

lint:
	npm run lint && npm run format:check

build:
	npm run build
