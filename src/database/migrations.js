const { query, testConnection } = require('./connection');
const logger = require('../utils/logger');

const migrations = [
  {
    name: 'create_conversations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL UNIQUE,
        messages JSONB NOT NULL DEFAULT '[]',
        state VARCHAR(50) NOT NULL DEFAULT 'active',
        cliente_nome VARCHAR(255),
        cliente_email VARCHAR(255),
        imoveis_vistos JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
    `,
  },
  {
    name: 'create_leads_table',
    sql: `
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL,
        nome VARCHAR(255),
        email VARCHAR(255),
        imovel_codigo VARCHAR(100),
        imovel_descricao TEXT,
        data_agendamento TIMESTAMP,
        status VARCHAR(50) DEFAULT 'novo',
        imoview_lead_id VARCHAR(100),
        imoview_agendamento_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_number);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    `,
  },
  {
    name: 'create_updated_at_trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
      CREATE TRIGGER update_conversations_updated_at
        BEFORE UPDATE ON conversations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
      CREATE TRIGGER update_leads_updated_at
        BEFORE UPDATE ON leads
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `,
  },
];

async function runMigrations() {
  await testConnection();

  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const existing = await query('SELECT id FROM migrations WHERE name = $1', [migration.name]);
    if (existing.rows.length > 0) {
      logger.debug(`Migration já executada: ${migration.name}`);
      continue;
    }

    logger.info(`Executando migration: ${migration.name}`);
    await query(migration.sql);
    await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
    logger.info(`Migration concluída: ${migration.name}`);
  }

  logger.info('Todas as migrations executadas com sucesso');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Erro ao executar migrations', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
