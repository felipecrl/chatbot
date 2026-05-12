const { query } = require('../database/connection');

async function getOrCreate(phoneNumber) {
  const existing = await query(
    'SELECT * FROM conversations WHERE phone_number = $1',
    [phoneNumber]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await query(
    'INSERT INTO conversations (phone_number) VALUES ($1) RETURNING *',
    [phoneNumber]
  );
  return result.rows[0];
}

async function addMessage(phoneNumber, role, content) {
  const conv = await getOrCreate(phoneNumber);
  const messages = conv.messages || [];
  messages.push({ role, content, timestamp: new Date().toISOString() });

  const result = await query(
    'UPDATE conversations SET messages = $1 WHERE phone_number = $2 RETURNING *',
    [JSON.stringify(messages), phoneNumber]
  );
  return result.rows[0];
}

async function updateState(phoneNumber, state) {
  await query(
    'UPDATE conversations SET state = $1 WHERE phone_number = $2',
    [state, phoneNumber]
  );
}

async function updateClienteInfo(phoneNumber, { nome, email }) {
  await query(
    'UPDATE conversations SET cliente_nome = COALESCE($1, cliente_nome), cliente_email = COALESCE($2, cliente_email) WHERE phone_number = $3',
    [nome, email, phoneNumber]
  );
}

async function addImovelVisto(phoneNumber, imovelCodigo) {
  await query(
    `UPDATE conversations
     SET imoveis_vistos = CASE
       WHEN imoveis_vistos @> $1::jsonb THEN imoveis_vistos
       ELSE imoveis_vistos || $1::jsonb
     END
     WHERE phone_number = $2`,
    [JSON.stringify([imovelCodigo]), phoneNumber]
  );
}

async function getMessages(phoneNumber) {
  const conv = await getOrCreate(phoneNumber);
  return conv.messages || [];
}

async function clearOldConversations(timeoutMinutes) {
  await query(
    `UPDATE conversations SET state = 'encerrada'
     WHERE state = 'active'
     AND updated_at < NOW() - INTERVAL '${timeoutMinutes} minutes'`
  );
}

module.exports = {
  getOrCreate,
  addMessage,
  updateState,
  updateClienteInfo,
  addImovelVisto,
  getMessages,
  clearOldConversations,
};
