# 📚 Índice de Documentação

Guia para encontrar o que você precisa na documentação do projeto.

---

## 🚀 Para começar

**Você nunca trabalhou neste projeto antes?**

1. Leia [quick-start.md](quick-start.md) — 5 minutos para sair do zero
2. Explore [commands.md](commands.md) — todos os comandos disponíveis
3. Veja [development.md](development.md) — fluxo de trabalho completo

---

## 📋 Por tarefa

### "Quero rodar o projeto localmente"

→ [quick-start.md](quick-start.md#3️⃣-inicie-o-projeto)

```bash
make start      # Tudo de uma vez
make stop       # Para tudo
```

### "Quero ver todos os comandos disponíveis"

→ [commands.md](commands.md)

- Comandos principais (start, stop, dev, test)
- Docker (dev-docker, dev-logs, dev-build)
- Database (migrate, studio)
- Qualidade (test, lint, build)

### "Quero desenvolver uma feature"

→ [development.md](development.md)

1. Criar branch: `feature/meu-recurso`
2. Fazer mudanças
3. Husky formata automaticamente
4. Criar PR (workflow automático)
5. Push dispara CI

### "Quero entender o GitFlow"

→ [gitflow.md](gitflow.md)

- Branches (develop, homolog, main)
- Fluxo de PRs (feature → develop → homolog → main)
- Branch protection rules
- Deploy automático

### "Quero rodar com Docker"

→ [docker-setup.md](docker-setup.md)

- Desarrollo com `make dev-docker`
- Produção com `make prod-up`
- PostgreSQL, Caddy, troubleshooting

### "Quero configurar o webhook do WhatsApp"

→ [webhook-setup.md](webhook-setup.md)

- Configurar uazapi (desenvolvimento)
- Configurar Meta (produção)
- Ngrok para expor porta local

### "Quero entender CI/CD e deploy"

→ [ci-cd.md](ci-cd.md)

- Workflows (auto-pr, validate-pr, promote, deploy)
- Testes de cobertura (95% threshold)
- Deploy automático em main
- Rollback automático

---

## 🔍 Por arquivo

| Arquivo                              | Leia se...                  | Resumo                                  |
| ------------------------------------ | --------------------------- | --------------------------------------- |
| [quick-start.md](quick-start.md)     | Quer começar rápido         | Setup em 5 minutos                      |
| [commands.md](commands.md)           | Quer referência de comandos | Todos os `make` e `npm`                 |
| [development.md](development.md)     | Vai desenvolver             | Workflow, Husky, boas práticas          |
| [docker-setup.md](docker-setup.md)   | Usa Docker                  | Containers, PostgreSQL, troubleshooting |
| [gitflow.md](gitflow.md)             | Faz PRs e deploy            | Branches, protection rules, workflow    |
| [ci-cd.md](ci-cd.md)                 | Quer entender automação     | GitHub Actions, testes, deploy          |
| [webhook-setup.md](webhook-setup.md) | Configura WhatsApp          | uazapi, Meta, ngrok                     |

---

## 🎯 Quick links por tecnologia

### Docker & Containers

- [docker-setup.md](docker-setup.md) — Setup completo
- [commands.md#-docker-compose--controle-granular](commands.md#-docker-compose--controle-granular) — Comandos Docker
- `make start` — Tudo automatizado

### Git & GitHub

- [gitflow.md](gitflow.md) — Fluxo de branches
- [development.md#git-hooks-husky](development.md#git-hooks-husky) — Husky hooks
- [ci-cd.md](ci-cd.md) — GitHub Actions workflows

### Banco de dados

- [docker-setup.md](docker-setup.md#desenvolvimento) — PostgreSQL setup
- [commands.md#️-banco-de-dados](commands.md#️-banco-de-dados) — Comandos DB
- [development.md#database](development.md#database) — Migrations e Prisma

### Testes & Qualidade

- [commands.md#-qualidade--testes](commands.md#-qualidade--testes) — Testes e lint
- [ci-cd.md](ci-cd.md#3-reusable-ciyml--workflow-reutilizável-centralized-ci) — Cobertura e thresholds
- [development.md#teste-antes-de-fazer-push](development.md#boas-práticas) — Boas práticas

### WhatsApp & Webhook

- [webhook-setup.md](webhook-setup.md) — Configuração
- [commands.md](commands.md) — Nenhum comando específico (usar API)

---

## 🤔 Dúvidas frequentes

### "Qual é o comando para começar?"

```bash
make start
```

→ [quick-start.md](quick-start.md#3️⃣-inicie-o-projeto)

### "Como parar o projeto?"

```bash
make stop
```

→ [commands.md#make-stop--para-todos-os-containers](commands.md#make-stop--para-todos-os-containers)

### "Como ver logs do app?"

```bash
make dev-logs
```

→ [commands.md#make-dev-logs--segue-logs-do-app](commands.md#make-dev-logs--segue-logs-do-app)

### "Como rodar testes?"

```bash
npm test                # Uma vez
npm run test:watch      # Watch mode
npm run test:coverage   # Com cobertura (95% threshold)
```

→ [commands.md#-qualidade--testes](commands.md#-qualidade--testes)

### "Como fazer uma feature?"

1. `git checkout -b feature/meu-recurso`
2. Fazer mudanças
3. `git push origin feature/meu-recurso`
4. PR criada automaticamente
5. Merge dispara promoção automática (develop → homolog → main)

→ [development.md](development.md) e [gitflow.md](gitflow.md)

### "Qual é a senha do banco?"

Está em `.env`, padrão: `123456`

→ [quick-start.md#2️⃣-configure-variáveis-de-ambiente](quick-start.md#2️⃣-configure-variáveis-de-ambiente)

### "Preciso resetar o banco?"

```bash
docker compose down -v    # Destrói volume, recria tudo
make start                # Sobe novamente
```

→ [docker-setup.md](docker-setup.md#7-derrubar)

### "Está falando de thresholds de cobertura?"

Mínimo 95% em testes. Se cair abaixo, o build falha.

```bash
npm run test:coverage
```

→ [commands.md#npm-run-test-coverage--cobertura-com-thresholds](commands.md#npm-run-test-coverage--cobertura-com-thresholds)

---

## 📞 Precisa de mais ajuda?

- Veja [docs/](.) para todos os arquivos
- Abra uma issue no GitHub
- Confira [README.md](../README.md) para overview geral

Última atualização: 2026-05-21
