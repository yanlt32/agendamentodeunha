const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');

const adapter = new FileSync(path.join(__dirname, 'data.json'));
const db = low(adapter);

db.defaults({
  users: [],
  services: [
    { id: 1, name: 'Manicure', description: 'Esmaltação completa das unhas das mãos', price: 35, duration: 60, active: true },
    { id: 2, name: 'Pedicure', description: 'Esmaltação completa das unhas dos pés', price: 40, duration: 75, active: true },
    { id: 3, name: 'Manicure + Pedicure', description: 'Combo completo mãos e pés', price: 70, duration: 120, active: true },
    { id: 4, name: 'Unhas em Gel', description: 'Alongamento e esmaltação em gel', price: 120, duration: 150, active: true },
    { id: 5, name: 'Nail Art', description: 'Decoração artística personalizada', price: 15, duration: 30, active: true }
  ],
  appointments: [],
  settings: {
    salon_name: 'Studio de Unhas',
    open_time: '08:00',
    close_time: '18:00',
    slot_duration: 60,
    working_days: [1, 2, 3, 4, 5, 6]
  },
  next_ids: { users: 1, appointments: 1 }
}).write();

// Cria admin padrão se não existir
const adminExists = db.get('users').find({ role: 'admin' }).value();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.get('users').push({
    id: db.get('next_ids.users').value(),
    name: 'Administrador',
    email: 'admin@salon.com',
    password: hash,
    phone: '',
    role: 'admin',
    created_at: new Date().toISOString()
  }).write();
  db.update('next_ids.users', n => n + 1).write();
}

module.exports = db;
