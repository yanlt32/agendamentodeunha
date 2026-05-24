require('dotenv').config();

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

async function testar() {
  const phone = '5511962094589'; // número para receber o teste
  const message = 'Teste do sistema de agendamento! ✅\nLembretes via WhatsApp funcionando.';

  console.log('Enviando mensagem para', phone, '...');
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ZAPI_CLIENT_TOKEN) headers['Client-Token'] = process.env.ZAPI_CLIENT_TOKEN;

  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message })
  });

  const data = await r.json();
  console.log('Resposta Z-API:', JSON.stringify(data, null, 2));
}

testar().catch(console.error);
