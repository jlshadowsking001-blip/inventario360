// ROUTES: Usuarios (Auth / Perfil / Recuperación)
// ------------------------------------------------
// Este archivo contiene los endpoints relacionados con usuarios:
//  - Registro e inicio de sesión (POST /registro, POST /login)
//  - Recuperación de contraseña (tokens) (POST /solicitar-recuperacion, POST /confirmar-recuperacion)
//  - Perfil (GET /perfil/:username, PUT /perfil/:username, POST /perfil/:username/foto)
//  - Rutas de depuración (GET /debug/list)

const validarLogin = require('../middlewares/validacionlogin');
const validarRegistro = require('../middlewares/validacionregistro');
const express = require('express');
const router = express.Router();
const db = require('../db');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
// Controller centralizado para usuarios
const usuarioController = require('../controles/usuariocontole');

// ENRUTAMIENTO PARA EL REGISTRO DE USUARIOS
// Delegar registro al controlador para evitar duplicación de lógica
router.post('/registro', validarRegistro, usuarioController.registrarUsuario);

// ENRUTAMIENTO PARA EL INICIO DE SESION
// Delegar inicio de sesión al controlador (manejo de bcrypt y respuesta)
router.post('/login', validarLogin, usuarioController.iniciarSesion);

// Solicitar recuperación con token de seguridad
router.post('/solicitar-recuperacion', (req, res) => {
  const { email } = req.body;
  const token = (require('crypto')).randomBytes(32).toString('hex');
  const expiracion = Date.now() + 15 * 60 * 1000;

  db.run(
    'INSERT INTO tokens_recuperacion (email, token, expiracion) VALUES (?, ?, ?)',
    [email, token, expiracion],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error al generar token' });

      const link = `http://localhost:3002/usuarios/confirmar-recuperacion?token=${token}`;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'tu-correo@gmail.com',
          pass: 'tu-app-password'
        }
      });

      const mailOptions = {
        from: 'Inventario360 <tu-correo@gmail.com>',
        to: email,
        subject: 'Recuperación de contraseña',
        html: `<p>Haz clic en el siguiente enlace para recuperar tu contraseña:</p><a href="${link}">${link}</a>`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) return res.status(500).json({ error: 'Error al enviar correo' });
        res.json({ mensaje: 'Correo de recuperación enviado' });
      });
    }
  );
});

// confirmar recuperación de contraseña
router.post('/confirmar-recuperacion', (req, res) => {
  const { token, nuevaContraseña } = req.body;

  db.get('SELECT email, expiracion FROM tokens_recuperacion WHERE token = ?', [token], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Token inválido' });
    if (Date.now() > row.expiracion) return res.status(403).json({ error: 'Token expirado' });

    const hashed = bcrypt.hashSync(nuevaContraseña, 10);
    db.run('UPDATE usuarios SET password = ? WHERE email = ?', [hashed, row.email], function (err) {
      if (err) return res.status(500).json({ error: 'Error al actualizar contraseña' });

      db.run('DELETE FROM tokens_recuperacion WHERE token = ?', [token]);
      res.json({ mensaje: 'Contraseña actualizada correctamente' });
    });
  });
});

// Ruta de depuración (temporal) para listar usuarios sin exponer hashes.
router.get('/debug/list', (req, res) => {
  db.all('SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url FROM usuarios', [], (err, rows) => {
    console.log('/usuarios/debug/list err:', err);
    console.log('/usuarios/debug/list rows:', rows);
    if (err) return res.status(500).json({ error: 'Error leyendo usuarios' });
    res.json({ usuarios: rows });
  });
});

// Ruta de prueba: intenta insertar un usuario temporal y lo borra (útil para comprobar permisos/DB)
router.get('/debug/test-write', (req, res) => {
  const testUser = `test_${Date.now()}`;
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('TestPass123', 10);
  db.run('INSERT INTO usuarios (username, password) VALUES (?, ?)', [testUser, hash], function(err) {
    if (err) {
      console.error('debug/test-write INSERT error:', err && err.message ? err.message : err);
      return res.status(500).json({ ok: false, error: 'No se pudo escribir en la BD', details: err.message });
    }
    const id = this.lastID;
    // intentar leerlo
    db.get('SELECT id, username FROM usuarios WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ ok: false, error: 'Insertado pero no se pudo leer', details: e.message });
      // eliminarlo
      db.run('DELETE FROM usuarios WHERE id = ?', [id], function(delErr) {
        if (delErr) console.warn('debug/test-write: no se pudo eliminar test user', delErr);
        res.json({ ok: true, inserted: row });
      });
    });
  });
});

// Obtener datos de perfil por username (sin devolver password)
router.get('/perfil/:username', (req, res) => {
  const username = req.params.username;
  db.get('SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url FROM usuarios WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Error al leer usuario:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ usuario: row });
  });
});

// Actualizar perfil de usuario
router.put('/perfil/:username', (req, res) => {
  const username = req.params.username;
  const { nombre, direccion, ciudad, pais, codigo_postal, detalles, email, telefono } = req.body;
  const params = [nombre || null, direccion || null, ciudad || null, pais || null, codigo_postal || null, detalles || null, email || null, telefono || null, username];
  const sql = `UPDATE usuarios SET nombre = ?, direccion = ?, ciudad = ?, pais = ?, codigo_postal = ?, detalles = ?, email = ?, telefono = ? WHERE username = ?`;
  db.run(sql, params, function (err) {
    if (err) {
      console.error('Error actualizando perfil:', err);
      return res.status(500).json({ error: 'Error al actualizar perfil' });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Devolver los nuevos datos
    db.get('SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url FROM usuarios WHERE username = ?', [username], (err2, row) => {
      if (err2) return res.status(500).json({ error: 'Error leyendo perfil actualizado' });
      res.json({ usuario: row });
    });
  });
});

// Subir foto de perfil (envía JSON { dataUrl })
const fs = require('fs');
const path = require('path');

router.post('/perfil/:username/foto', (req, res) => {
  const username = req.params.username;
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl requerido' });

  // dataUrl example: data:image/png;base64,AAAABBBB...
  const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Formato dataUrl inválido' });
  const mime = matches[1];
  const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
  const base64Data = matches[3];

  const uploadsDir = path.join(__dirname, '..', 'publico', 'uploads');
  try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch (err) { console.error('mkdir error', err); }

  const filename = `${username.replace(/[^a-z0-9_-]/gi,'')}_${Date.now()}.${ext}`;
  const filepath = path.join(uploadsDir, filename);
  const publicPath = `/uploads/${filename}`;

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFile(filepath, buffer, (err) => {
    if (err) {
      console.error('Error guardando imagen:', err);
      return res.status(500).json({ error: 'No se pudo guardar la imagen' });
    }
    // actualizar columna foto_url en usuarios
    db.run('UPDATE usuarios SET foto_url = ? WHERE username = ?', [publicPath, username], function (uerr) {
      if (uerr) {
        console.error('Error guardando foto_url en DB:', uerr);
        return res.status(500).json({ error: 'No se pudo guardar referencia en la BD' });
      }
      res.json({ foto_url: publicPath });
    });
  });
});

module.exports = router;