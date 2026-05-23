const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireClient } = require('../middleware/auth');

// Configurações públicas (taxa, nome)
router.get('/settings', (req, res) => {
  const s = db.get('settings').value();
  res.json({ booking_fee: s.booking_fee || 20, salon_name: s.salon_name });
});

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
    .filter(a => a.date === date && ['pending', 'confirmed', 'completed'].includes(a.status))
    .value();

  const isToday = date === new Date().toISOString().slice(0, 10);
  const nowMins = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  const slots = [];
  for (let m = openMins; m + service.duration <= closeMins; m += settings.slot_duration) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    const time = `${h}:${min}`;

    if (isToday && m <= nowMins) {
      slots.push({ time, available: false, service_name: null, past: true });
      continue;
    }

    const conflictApt = booked.find(a => {
      const [ah, am] = a.time.split(':').map(Number);
      const aptStart = ah * 60 + am;
      const aptEnd = aptStart + a.duration;
      return m < aptEnd && m + service.duration > aptStart;
    });

    slots.push({
      time,
      available: !conflictApt,
      service_name: conflictApt ? conflictApt.service_name : null
    });
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
    .filter(a => a.date === date && ['pending', 'confirmed', 'completed'].includes(a.status))
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

// Perfil do cliente
router.get('/profile', requireClient, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, created_at: user.created_at });
});

router.put('/profile', requireClient, (req, res) => {
  const { name, phone, password, new_password } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const updates = { name, phone };

  if (new_password) {
    const bcrypt = require('bcryptjs');
    if (!password) return res.status(400).json({ error: 'Informe a senha atual para alterá-la' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Senha atual incorreta' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    updates.password = bcrypt.hashSync(new_password, 10);
  }

  db.get('users').find({ id: req.user.id }).assign(updates).write();
  res.json({ success: true });
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
