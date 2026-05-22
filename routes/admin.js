const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// Dashboard stats
router.get('/stats', requireAdmin, (req, res) => {
  const appointments = db.get('appointments').value();
  const users = db.get('users').filter({ role: 'client' }).value();
  const today = new Date().toISOString().split('T')[0];

  const revenue_confirmed = appointments.filter(a => a.status === 'confirmed').reduce((s, a) => s + (a.price || 0), 0);
  const revenue_completed = appointments.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0);
  res.json({
    total_clients: users.length,
    total_appointments: appointments.length,
    today_appointments: appointments.filter(a => a.date === today).length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    revenue_confirmed,
    revenue_completed,
    revenue: revenue_confirmed + revenue_completed
  });
});

// Agendamentos
router.get('/appointments', requireAdmin, (req, res) => {
  const { date, status } = req.query;
  let list = db.get('appointments').value();
  if (date) list = list.filter(a => a.date === date);
  if (status) list = list.filter(a => a.status === status);
  list.sort((a, b) => (a.date + a.time) > (b.date + b.time) ? -1 : 1);
  res.json(list);
});

router.patch('/appointments/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body;
  const apt = db.get('appointments').find({ id }).value();
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado' });

  db.get('appointments').find({ id }).assign({ status, notes: notes || apt.notes, updated_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

router.delete('/appointments/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.get('appointments').remove({ id }).write();
  res.json({ success: true });
});

// Serviços
router.get('/services', requireAdmin, (req, res) => {
  res.json(db.get('services').value());
});

router.post('/services', requireAdmin, (req, res) => {
  const { name, description, price, duration } = req.body;
  if (!name || !price || !duration) return res.status(400).json({ error: 'Preencha todos os campos' });

  const services = db.get('services').value();
  const id = services.length > 0 ? Math.max(...services.map(s => s.id)) + 1 : 1;
  const service = { id, name, description: description || '', price: parseFloat(price), duration: parseInt(duration), active: true };

  db.get('services').push(service).write();
  res.json({ success: true, service });
});

router.put('/services/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, price, duration, active } = req.body;
  db.get('services').find({ id }).assign({ name, description, price: parseFloat(price), duration: parseInt(duration), active }).write();
  res.json({ success: true });
});

router.delete('/services/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.get('services').remove({ id }).write();
  res.json({ success: true });
});

// Clientes
router.get('/clients', requireAdmin, (req, res) => {
  const users = db.get('users').filter({ role: 'client' }).value().map(u => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, created_at: u.created_at
  }));
  res.json(users);
});

// Configurações
router.get('/settings', requireAdmin, (req, res) => {
  res.json(db.get('settings').value());
});

router.put('/settings', requireAdmin, (req, res) => {
  const { salon_name, open_time, close_time, slot_duration, working_days, booking_fee } = req.body;
  db.set('settings', { salon_name, open_time, close_time, slot_duration: parseInt(slot_duration), working_days, booking_fee: parseFloat(booking_fee) || 20 }).write();
  res.json({ success: true });
});

module.exports = router;
