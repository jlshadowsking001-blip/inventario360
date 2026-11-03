// Middleware que valida y normaliza el payload de registro (usuario, contraseña, email y teléfono).
module.exports = (req, res, next) => {
    const { username, password, email } = req.body;
    const { telefono } = req.body || {};
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Ingresa un correo electrónico válido' });
    }
    if (typeof telefono !== 'string' || !/^\+[1-9]\d{7,14}$/.test(telefono.trim())) {
        return res.status(400).json({ error: 'Ingresa el teléfono en formato internacional, por ejemplo +50588888888' });
    }
    req.body.email = email.trim().toLowerCase();
    req.body.telefono = telefono.trim();
    next();
};