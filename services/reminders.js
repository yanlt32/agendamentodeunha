const cron = require('node-cron');
const https = require('https');
const http = require('http');
const db = require('../db/database');

const EVO_URL      = process.env.EVOLUTION_API_URL  || '';
const EVO_KEY      = process.env.EVOLUTION_API_KEY  || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || '';

function formatPhone(raw) {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('55')) d = '55' + d;
  return d;
}

function sendWhatsApp(phone, message) {
  const number = formatPhone(phone);
  if (!number || number.length < 12) {
    console.log(`[Reminder] Número inválido ignorado: ${phone}`);
    return Promise.resolve({ skipped: true });
  }

  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    console.log(`[Reminder] Evolution API não configurada. Simulando envio para ${number}:\n${message}`);
    return Promise.resolve({ simulated: true });
  }

  const body = JSON.stringify({ number, textMessage: { text: message } });
  let parsedUrl;
  try { parsedUrl = new URL(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`); }
  catch { console.error('[Reminder] EVOLUTION_API_URL inválida'); return Promise.resolve(); }

  const isHttps = parsedUrl.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve) => {
    const req = lib.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`[Reminder] Enviado para ${number} — status ${res.statusCode}`);
        resolve({ status: res.statusCode });
      });
    });
    req.on('error', err => { console.error('[Reminder] Erro HTTP:', err.message); resolve({ error: err.message }); });
    req.write(body);
    req.end();
  });
}

function fmtDate(s) {
  const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`;
}

async function sendReminder(apt, type) {
  const user = db.get('users').find({ id: apt.user_id }).value();
  if (!user || !user.phone) return { skipped: 'sem telefone' };

  const salon = (db.get('settings').value().salon_name) || 'Studio de Unhas';
  const first = apt.user_name.split(' ')[0];

  const msg = type === '1day'
    ? `Olá, ${first}! 😊 Lembrando que seu agendamento é *amanhã*.\n\n💅 *${apt.service_name}*\n📅 ${fmtDate(apt.date)} às ${apt.time}\n⏱ Duração: ${apt.duration} min\n\nCaso precise cancelar, entre em contato com antecedência.\n\n— ${salon}`
    : `Olá, ${first}! ✨ Seu atendimento é em aproximadamente *2 horas*.\n\n💅 *${apt.service_name}*\n⏰ Hoje às ${apt.time}\n\nTe esperamos!\n\n— ${salon}`;

  const result = await sendWhatsApp(user.phone, msg);

  const sent = Array.isArray(apt.reminders_sent) ? apt.reminders_sent : [];
  db.get('appointments').find({ id: apt.id })
    .assign({ reminders_sent: [...sent, type] })
    .write();

  return result;
}

async function sendOneDayReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const apts = db.get('appointments')
    .filter(a => a.date === tomorrowStr && ['pending', 'confirmed'].includes(a.status))
    .value();

  let count = 0;
  for (const apt of apts) {
    const sent = apt.reminders_sent || [];
    if (sent.includes('1day')) continue;
    await sendReminder(apt, '1day');
    count++;
  }
  console.log(`[Reminder] 1 dia antes: ${count} lembrete(s) enviado(s)`);
  return count;
}

async function sendTwoHourReminders() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const targetMins = target.getHours() * 60 + target.getMinutes();

  const apts = db.get('appointments')
    .filter(a => {
      if (a.date !== todayStr) return false;
      if (!['pending', 'confirmed'].includes(a.status)) return false;
      const [ah, am] = a.time.split(':').map(Number);
      return Math.abs((ah * 60 + am) - targetMins) <= 10;
    })
    .value();

  let count = 0;
  for (const apt of apts) {
    const sent = apt.reminders_sent || [];
    if (sent.includes('2hours')) continue;
    await sendReminder(apt, '2hours');
    count++;
  }
  console.log(`[Reminder] 2 horas antes: ${count} lembrete(s) enviado(s)`);
  return count;
}

async function sendManualReminder(aptId) {
  const apt = db.get('appointments').find({ id: aptId }).value();
  if (!apt) return { error: 'Agendamento não encontrado' };
  return await sendReminder(apt, 'manual');
}

function startReminderScheduler() {
  // Todo dia às 09:00 — lembrete de 1 dia antes
  cron.schedule('0 9 * * *', () => {
    console.log('[Reminder] Disparando lembretes de 1 dia antes...');
    sendOneDayReminders().catch(console.error);
  }, { timezone: 'America/Sao_Paulo' });

  // A cada hora cheia — lembrete de 2 horas antes
  cron.schedule('0 * * * *', () => {
    console.log('[Reminder] Verificando lembretes de 2 horas antes...');
    sendTwoHourReminders().catch(console.error);
  }, { timezone: 'America/Sao_Paulo' });

  console.log('[Reminder] Agendador iniciado (09h diário + verificação horária).');
}

module.exports = { startReminderScheduler, sendOneDayReminders, sendTwoHourReminders, sendManualReminder };
