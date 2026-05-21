const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'salon_secret_2024';

function verifyToken(req, res, next) {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    next();
  });
}

function requireClient(req, res, next) {
  verifyToken(req, res, () => {
    if (!['client', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    next();
  });
}

module.exports = { verifyToken, requireAdmin, requireClient, SECRET };
