const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireClient } = require('../middleware/auth');

// Listar serviços disponíveis
router.get('/services', (req, res) => {
  const services = db.get('services').filter({ active: true }).value();
  res.json(services);
});

// Horários disponíveis para uma data e serviço
router.get('/available-slots', (req, res) => {
  const { date, service_id } = req.query;
  if (!date || !service_id) return res.status(400).json({ error: 'Data e serviço são obrigatórios' });

  const settings = db.get('settings').value();
  const service = db.get('services').find({ id: parseInt(service_id) }).value();
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  if (!settings.working_days.includes(dayOfWeek)) return res.json([]);

  const [openH, openM] = settings.open_time.split(':').map(Number);
  const [closeH, closeM] = settings.close_time.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;

  const booked = db.get('appointments')
    .filter(a => a.date === date && ['pending', 'confirmed'].includes(a.status))
    .value();

  const slots = [];
  for (let m = openMins; m + service.duration <= closeMins; m += settings.slot_duration) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    const time = `${h}:${min}`;

    const conflict = booked.some(a => {
      const [ah, am] = a.time.split(':').map(Number);
      const aptStart = ah * 60 + am;
      const aptEnd = aptStart + a.duration;
      return m < aptEnd && m + service.duration > aptStart;
    });

    if (!conflict) slots.push(time);
  }
  res.json(slots);
});

// Criar agendamento
router.post('/appointments', requireClient, (req, res) => {
  const { service_id, date, time, notes } = req.body;
  if (!service_id || !date || !time) return res.status(400).json({ error: 'Preencha todos os campos' });

  const service = db.get('services').find({ id: parseInt(service_id), active: true }).value();
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

  const settings = db.get('settings').value();
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  if (!settings.working_days.includes(dayOfWeek)) return res.status(400).json({ error: 'Data não disponível' });

  const booked = db.get('appointments')
    .filter(a => a.date === date && ['pending', 'confirmed'].includes(a.status))
    .value();

  const [th, tm] = time.split(':').map(Number);
  const reqStart = th * 60 + tm;
  const conflict = booked.some(a => {
    const [ah, am] = a.time.split(':').map(Number);
    const aptStart = ah * 60 + am;
    const aptEnd = aptStart + a.duration;
    return reqStart < aptEnd && reqStart + service.duration > aptStart;
  });
  if (conflict) return res.status(400).json({ error: 'Horário não disponível' });

  const id = db.get('next_ids.appointments').value();
  const appointment = {
    id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_email: req.user.email,
    service_id: service.id,
    service_name: service.name,
    price: service.price,
    duration: service.duration,
    date,
    time,
    notes: notes || '',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.get('appointments').push(appointment).write();
  db.update('next_ids.appointments', n => n + 1).write();
  res.json({ success: true, appointment });
});

// Meus agendamentos
router.get('/appointments', requireClient, (req, res) => {
  const list = db.get('appointments')
    .filter({ user_id: req.user.id })
    .value()
    .sort((a, b) => (a.date + a.time) > (b.date + b.time) ? -1 : 1);
  res.json(list);
});

// Cancelar agendamento
router.patch('/appointments/:id/cancel', requireClient, (req, res) => {
  const id = parseInt(req.params.id);
  const apt = db.get('appointments').find({ id, user_id: req.user.id }).value();
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado' });
  if (apt.status === 'confirmed') return res.status(400).json({ error: 'Não é possível cancelar um agendamento confirmado. Entre em contato com o salão.' });

  db.get('appointments').find({ id }).assign({ status: 'cancelled', updated_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

module.exports = router;
