require('dotenv').config();
const db = require('./db/database');
const { sendWhatsApp } = require('./services/whatsapp');

async function testar() {
  // Pega o primeiro agendamento que existir
  const apt = db.get('appointments').value()[0];

  if (!apt) {
    console.log('Nenhum agendamento no banco. Crie um agendamento primeiro.');
    return;
  }

  const user = db.get('users').find({ id: apt.user_id }).value();
  if (!user || !user.phone) {
    console.log('Usuário sem telefone:', apt.user_name);
    return;
  }

  const date = apt.date.split('-').reverse().join('/');
  const msg = `Olá ${apt.user_name}! 😊\n\nLembrete do seu agendamento:\n📅 ${date} às ${apt.time}\n💅 ${apt.service_name}\n\nTe esperamos! 💅`;

  console.log('Enviando para:', user.phone);
  console.log('Mensagem:\n', msg);

  const result = await sendWhatsApp(user.phone, msg);
  console.log('Resposta:', JSON.stringify(result, null, 2));
}

testar().catch(console.error);
