const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

async function sendWhatsApp(phone, message) {
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
    console.log('[WhatsApp SIMULADO]', phone, ':', message);
    return { simulated: true };
  }
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
  const headers = { 'Content-Type': 'application/json' };
  if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: formatPhone(phone), message })
  });
  return r.json();
}

module.exports = { sendWhatsApp, formatPhone };
