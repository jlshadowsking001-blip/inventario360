const db = require('../db');
const bcrypt = require('bcryptjs');

// iniciar sesion (seguro: compara hash)
exports.iniciarSesion = (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, usuario) => {
        if (err) return res.status(500).json({ error: 'Error en la base de datos' });
        if (!usuario) return res.status(401).json({ error: 'Usuario no encontrado' });
        try {
            const ok = bcrypt.compareSync(password, usuario.password);
            if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
            res.status(200).json({ mensaje: 'Inicio de sesión exitoso', usuario: { id: usuario.id, username: usuario.username, email: usuario.email } });
        } catch (e) {
            return res.status(500).json({ error: 'Error verificando contraseña' });
        }
    });
};

// registrar usuarios (hashea la contraseña)
exports.registrarUsuario = (req, res) => {
    const { username, password, email, telefono } = req.body;
    console.log('RegistrarUsuario -> body:', { username, email, telefono });
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO usuarios (username, password, email, telefono) VALUES (?, ?, ?, ?)', [username, hash, email || null, telefono || null], function (err) {
        if (err) {
            console.error('Error INSERT usuarios:', err && err.message ? err.message : err);
            if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'El usuario ya existe' });
            return res.status(500).json({ error: 'Error al registrar usuario', details: err.message });
        }
        console.log('Usuario insertado con id:', this.lastID);
        // Devolver el usuario sin password
        db.get('SELECT id, username, email, telefono, nombre FROM usuarios WHERE id = ?', [this.lastID], (e, row) => {
            if (e) {
                console.error('Error leyendo usuario insertado:', e);
                return res.status(201).json({ mensaje: 'Usuario registrado (lectura fallida)', id: this.lastID });
            }
            res.status(200).json({ mensaje: 'Usuario registrado correctamente', usuario: row });
        });
    });
};