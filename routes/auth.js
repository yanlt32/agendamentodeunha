const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { SECRET } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });

  const exists = db.get('users').find({ email }).value();
  if (exists) return res.status(400).json({ error: 'E-mail já cadastrado' });

  const hash = bcrypt.hashSync(password, 10);
  const id = db.get('next_ids.users').value();
  const user = { id, name, email, password: hash, phone: phone || '', role: 'client', created_at: new Date().toISOString() };

  db.get('users').push(user).write();
  db.update('next_ids.users', n => n + 1).write();

  const token = jwt.sign({ id, name, email, role: 'client' }, SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, role: 'client' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });

  const user = db.get('users').find({ email }).value();
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, role: user.role });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', require('../middleware/auth').verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
