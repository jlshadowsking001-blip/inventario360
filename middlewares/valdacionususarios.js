module.exports = (req, res, next) => {
    const { username, password, email, telefono } = req.body;
     // Validación común
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Validación adicional solo para registro
    if (req.path.includes('registro')) {
        if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
        }

    if (!telefono || !/^\d{9,12}$/.test(telefono)) {
    return res.status(400).json({ error: 'El teléfono debe tener entre 9 y 12 dígitos numéricos' });
        }
    }
    next();
};

