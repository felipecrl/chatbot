const { Pool } = require('pg');
const { config } = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.database.connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool do PostgreSQL', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Query executada', { duration, rows: result.rowCount });
  return result;
}

async function testConnection() {
  const client = await pool.connect();
  client.release();
  logger.info('Conexão com PostgreSQL estabelecida com sucesso');
}

module.exports = { query, testConnection, pool };
