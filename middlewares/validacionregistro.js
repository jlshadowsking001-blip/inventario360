module.exports = (req, res, next) => {
    const { username, password, email } = req.body;
    let { telefono } = req.body || {};
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    // Normalizar teléfono: permitir formatos con espacios/guiones y eliminar no dígitos
    if (telefono && typeof telefono === 'string') {
        const digits = telefono.replace(/\D/g, '');
        if (digits.length === 0) {
            telefono = null; // tratar como no proporcionado
        } else if (!/^\d{8,12}$/.test(digits)) {
            return res.status(400).json({ error: 'Teléfono inválido (debe tener entre 8 y 12 dígitos)' });
        } else {
            // Reescribir teléfono en el body con la versión normalizada
            req.body.telefono = digits;
        }
    }
    // email y telefono son opcionales en el registro; si se proporcionan, validarlos
    if (email && (!email.includes('@') || typeof email !== 'string')) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
    }
    next();
};