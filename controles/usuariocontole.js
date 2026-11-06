const db = require('../db');
const bcrypt = require('bcryptjs');
const verificacion = require('../servicios/verificacion');

// iniciar sesion (seguro: compara hash)
// Controlador que verifica credenciales contra la tabla usuarios y responde con info básica.
exports.iniciarSesion = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    try {
        const usuario = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
        if (!usuario) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        if (!bcrypt.compareSync(password, usuario.password)) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const emailPendiente = !Number(usuario.email_verificado);
        const telefonoPendiente = Number(usuario.telefono_requerido) && !Number(usuario.telefono_verificado);
        if (emailPendiente || telefonoPendiente) {
            if ((emailPendiente && (!usuario.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario.email))) ||
                (telefonoPendiente && (!usuario.telefono || !/^\+[1-9]\d{7,14}$/.test(usuario.telefono)))) {
                return res.status(409).json({
                    error: 'Falta un correo o teléfono válido para verificar la cuenta. Contacta al administrador para actualizar tus datos.'
                });
            }
            const verificacionPendiente = await verificacion.sendAccountCodes(usuario);
            return res.status(403).json({
                verificacionRequerida: true,
                username: usuario.username,
                canalesPendientes: verificacionPendiente.pending,
                canalesEnviados: verificacionPendiente.sent,
                errorEnvio: verificacionPendiente.failed.length ? 'No se pudieron enviar todos los códigos. Revisa la configuración o solicita reenviarlos.' : null
            });
        }

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            usuario: { id: usuario.id, username: usuario.username, email: usuario.email }
        });
    } catch (error) {
        console.error('Error en inicio de sesión:', error);
        return res.status(500).json({ error: 'Error verificando las credenciales' });
    }
};

// registrar usuarios (hashea la contraseña)
// Controlador que crea un usuario nuevo, valida duplicados y devuelve el registro sin password.
exports.registrarUsuario = async (req, res) => {
    const { username, password, email, telefono } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });

    try {
        const duplicado = await db.get(
            'SELECT id FROM usuarios WHERE username = ? OR LOWER(email) = LOWER(?) OR telefono = ? LIMIT 1',
            [username, email, telefono]
        );
        if (duplicado) return res.status(409).json({ error: 'El usuario, correo o teléfono ya está registrado' });

        const hash = bcrypt.hashSync(password, 10);
        const usuarioId = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO usuarios (username, password, email, telefono, telefono_canal, email_verificado, telefono_verificado, telefono_requerido) VALUES (?, ?, ?, ?, ?, 0, 0, 1)',
                [username, hash, email, telefono, req.body.canalTelefono],
                function (error) {
                    if (error) return reject(error);
                    resolve(this.lastID);
                }
            );
        });
        const usuario = await db.get(
            'SELECT id, username, email, telefono, telefono_canal, email_verificado, telefono_verificado, telefono_requerido FROM usuarios WHERE id = ?',
            [usuarioId]
        );
        const envio = await verificacion.sendAccountCodes(usuario);
        return res.status(201).json({
            mensaje: 'Cuenta creada. Confirma los códigos enviados a tu correo y al canal telefónico seleccionado.',
            usuario: { id: usuario.id, username: usuario.username },
            canalesPendientes: envio.pending,
            canalesEnviados: envio.sent,
            errorEnvio: envio.failed.length ? 'No se pudieron enviar todos los códigos. Configura los servicios y vuelve a iniciar sesión para reenviarlos.' : null
        });
    } catch (error) {
        console.error('Error registrando usuario:', error);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'Error al registrar usuario' });
    }
};

exports.reenviarVerificacion = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    try {
        const usuario = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
        if (!usuario || !bcrypt.compareSync(password, usuario.password)) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        if (Number(usuario.email_verificado) && (!Number(usuario.telefono_requerido) || Number(usuario.telefono_verificado))) {
            return res.json({ verificado: true, mensaje: 'La cuenta ya está verificada.' });
        }
        const envio = await verificacion.sendAccountCodes(usuario);
        return res.json({
            canalesPendientes: envio.pending,
            canalesEnviados: envio.sent,
            errorEnvio: envio.failed.length ? 'No se pudieron enviar todos los códigos. Revisa la configuración del proveedor.' : null
        });
    } catch (error) {
        console.error('Error reenviando códigos de verificación:', error);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudieron reenviar los códigos' });
    }
};