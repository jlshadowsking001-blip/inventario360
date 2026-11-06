// Middleware que valida y normaliza el payload de registro (usuario, contraseña, email y teléfono).
module.exports = (req, res, next) => {
    const { username, password, email, telefono } = req.body;
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Ingresa un correo electrónico válido' });
    }
    if (telefono !== undefined && telefono !== null && typeof telefono !== 'string') {
        return res.status(400).json({ error: 'El teléfono debe ser texto en formato internacional' });
    }
    const telefonoNormalizado = typeof telefono === 'string' ? telefono.trim() : '';
    if (telefonoNormalizado && !/^\+[1-9]\d{7,14}$/.test(telefonoNormalizado)) {
        return res.status(400).json({ error: 'El teléfono debe estar en formato internacional, por ejemplo +50588888888' });
    }
    req.body.email = email.trim().toLowerCase();
    req.body.telefono = telefonoNormalizado || null;
    next();
};