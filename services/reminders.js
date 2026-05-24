const cron = require('node-cron');
const db = require('../db/database');
const { sendWhatsApp } = require('./whatsapp');

function buildMessage(apt, type) {
  const date = apt.date.split('-').reverse().join('/');
  if (type === '1day') {
    return `Olá ${apt.user_name}! 😊\n\nLembrete: você tem um agendamento amanhã (${date}) às ${apt.time} para *${apt.service_name}*.\n\nQualquer dúvida, estamos à disposição!`;
  }
  return `Olá ${apt.user_name}! ⏰\n\nSeu agendamento de *${apt.service_name}* é em 2 horas — hoje às ${apt.time}.\n\nTe esperamos! 💅`;
}

async function sendOneDayReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const apts = db.get('appointments')
    .filter(a => a.date === dateStr && ['pending', 'confirmed'].includes(a.status))
    .value();

  for (const apt of apts) {
    const sent = apt.reminders_sent || [];
    if (sent.includes('1day')) continue;

    const user = db.get('users').find({ id: apt.user_id }).value();
    if (!user || !user.phone) continue;

    try {
      await sendWhatsApp(user.phone, buildMessage(apt, '1day'));
      db.get('appointments').find({ id: apt.id })
        .assign({ reminders_sent: [...sent, '1day'] }).write();
      console.log(`[Lembrete 1dia] Enviado para ${user.phone} - apt ${apt.id}`);
    } catch (e) {
      console.error(`[Lembrete 1dia] Erro apt ${apt.id}:`, e.message);
    }
  }
}

async function sendTwoHourReminders() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = nowMins + 120;

  const apts = db.get('appointments')
    .filter(a => a.date === today && ['pending', 'confirmed'].includes(a.status))
    .value();

  for (const apt of apts) {
    const [h, m] = apt.time.split(':').map(Number);
    const aptMins = h * 60 + m;
    if (aptMins < targetMins - 10 || aptMins > targetMins + 10) continue;

    const sent = apt.reminders_sent || [];
    if (sent.includes('2h')) continue;

    const user = db.get('users').find({ id: apt.user_id }).value();
    if (!user || !user.phone) continue;

    try {
      await sendWhatsApp(user.phone, buildMessage(apt, '2h'));
      db.get('appointments').find({ id: apt.id })
        .assign({ reminders_sent: [...sent, '2h'] }).write();
      console.log(`[Lembrete 2h] Enviado para ${user.phone} - apt ${apt.id}`);
    } catch (e) {
      console.error(`[Lembrete 2h] Erro apt ${apt.id}:`, e.message);
    }
  }
}

async function sendManualReminder(aptId) {
  const apt = db.get('appointments').find({ id: aptId }).value();
  if (!apt) return { error: 'Agendamento não encontrado' };

  const user = db.get('users').find({ id: apt.user_id }).value();
  if (!user || !user.phone) return { error: 'Cliente sem telefone cadastrado' };

  const date = apt.date.split('-').reverse().join('/');
  const msg = `Olá ${apt.user_name}! 😊\n\nLembrete do seu agendamento:\n📅 ${date} às ${apt.time}\n💅 ${apt.service_name}\n\nQualquer dúvida estamos à disposição!`;

  return sendWhatsApp(user.phone, msg);
}

function startReminderScheduler() {
  cron.schedule('0 9 * * *', sendOneDayReminders, { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 * * * *', sendTwoHourReminders, { timezone: 'America/Sao_Paulo' });
  console.log('[Lembretes] Agendador iniciado');
}

module.exports = { startReminderScheduler, sendManualReminder };
