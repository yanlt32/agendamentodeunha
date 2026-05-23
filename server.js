require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { startReminderScheduler } = require('./services/reminders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { etag: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/client', require('./routes/client'));

const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
};

app.get('/admin',  noCache, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/client', noCache, (req, res) => res.sendFile(path.join(__dirname, 'public', 'client.html')));
app.get('*',       noCache, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Admin padrão: admin@salon.com / admin123');
  startReminderScheduler();
});
