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
const bcrypt = require('bcryptjs');
const verificacion = require('../servicios/verificacion');
const { parseImageDataUrl } = require('../servicios/imagenes');
// Controller centralizado para usuarios
const usuarioController = require('../controles/usuariocontole');

// ENRUTAMIENTO PARA EL REGISTRO DE USUARIOS
// Delegar registro al controlador para evitar duplicación de lógica
router.post('/registro', validarRegistro, usuarioController.registrarUsuario);

// ENRUTAMIENTO PARA EL INICIO DE SESION
// Delegar inicio de sesión al controlador (manejo de bcrypt y respuesta)
router.post('/login', validarLogin, usuarioController.iniciarSesion);
router.post('/reenviar-verificacion', usuarioController.reenviarVerificacion);

router.post('/verificar-cuenta', async (req, res) => {
  const { username, canal, codigo } = req.body;
  if (!username || !['email', 'sms'].includes(canal) || !/^\d{6}$/.test(String(codigo || ''))) {
    return res.status(400).json({ error: 'Usuario, canal y código de seis dígitos son requeridos' });
  }
  try {
    const usuario = await db.get('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (!usuario) return res.status(400).json({ error: 'No se pudo verificar el código' });
    await verificacion.verifyCode(usuario.id, 'registro', canal, codigo);
    const estado = await db.get(
      'SELECT email_verificado, telefono_verificado, telefono_requerido FROM usuarios WHERE id = ?',
      [usuario.id]
    );
    const canalesPendientes = [];
    if (!Number(estado.email_verificado)) canalesPendientes.push('email');
    if (Number(estado.telefono_requerido) && !Number(estado.telefono_verificado)) canalesPendientes.push('sms');
    return res.json({
      verificada: canalesPendientes.length === 0,
      telefonoPendiente: !Number(estado.telefono_requerido) && !Number(estado.telefono_verificado),
      canalesPendientes,
      mensaje: canalesPendientes.length ? 'Código válido. Falta verificar el otro canal.' : 'Cuenta verificada correctamente.'
    });
  } catch (error) {
    console.error('Error verificando cuenta:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo verificar la cuenta' });
  }
});

router.post('/solicitar-recuperacion', async (req, res) => {
  const { username, canal } = req.body;
  if (!username || !['email', 'sms'].includes(canal)) {
    return res.status(400).json({ error: 'Usuario y canal de recuperación requeridos' });
  }
  try {
    const usuario = await db.get(
      'SELECT id, email, telefono, email_verificado, telefono_verificado FROM usuarios WHERE username = ?',
      [username]
    );
    const canalVerificado = usuario && (canal === 'email'
      ? Number(usuario.email_verificado)
      : Number(usuario.telefono_verificado));
    if (canalVerificado) await verificacion.issueCode(usuario, 'recuperacion', canal);
    return res.json({ mensaje: 'Si la cuenta y el canal son válidos, recibirás un código de recuperación.' });
  } catch (error) {
    console.error('Error solicitando recuperación:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo enviar el código' });
  }
});

router.post('/confirmar-recuperacion', async (req, res) => {
  const { username, canal, codigo, nuevaContraseña } = req.body;
  if (!username || !['email', 'sms'].includes(canal) || !/^\d{6}$/.test(String(codigo || ''))) {
    return res.status(400).json({ error: 'Usuario, canal y código de seis dígitos son requeridos' });
  }
  if (typeof nuevaContraseña !== 'string' || nuevaContraseña.length < 8 || nuevaContraseña.length > 100) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 100 caracteres' });
  }
  try {
    const usuario = await db.get('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (!usuario) return res.status(400).json({ error: 'El código no es válido o ya fue utilizado.' });
    await verificacion.verifyCode(usuario.id, 'recuperacion', canal, codigo);
    const hashed = bcrypt.hashSync(nuevaContraseña, 10);
    await db.run('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, usuario.id]);
    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error confirmando recuperación:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo actualizar la contraseña' });
  }
});

// Lista usuarios con datos básicos para verificar contenido de la BD sin exponer contraseñas
router.get('/debug/list', (req, res) => {
  db.all('SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url FROM usuarios', [], (err, rows) => {
    console.log('/usuarios/debug/list err:', err);
    console.log('/usuarios/debug/list rows:', rows);
    if (err) return res.status(500).json({ error: 'Error leyendo usuarios' });
    res.json({ usuarios: rows });
  });
});

// Inserta usuario temporal para comprobar permisos de escritura y luego lo elimina
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

// Devuelve información de perfil filtrada por username sin exponer password
router.get('/perfil/:username', (req, res) => {
  const username = req.params.username;
  db.get('SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url, image_mime FROM usuarios WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Error al leer usuario:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (row.image_mime) row.foto_url = `/usuarios/perfil/${encodeURIComponent(username)}/foto`;
    delete row.image_mime;
    res.json({ usuario: row });
  });
});

// Actualiza datos de contacto/dirección del usuario y devuelve el registro actualizado
router.put('/perfil/:username', async (req, res) => {
  const username = req.params.username;
  const { nombre, direccion, ciudad, pais, codigo_postal, detalles, email, telefono } = req.body;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Correo electrónico inválido' });
  }
  if (telefono && !/^\+[1-9]\d{7,14}$/.test(String(telefono).trim())) {
    return res.status(400).json({ error: 'El teléfono debe estar en formato internacional, por ejemplo +50588888888' });
  }
  const emailNormalizado = email ? String(email).trim().toLowerCase() : null;
  const telefonoNormalizado = telefono ? String(telefono).trim() : null;
  const params = [
    emailNormalizado, telefonoNormalizado, telefonoNormalizado, telefonoNormalizado,
    nombre || null, direccion || null, ciudad || null, pais || null, codigo_postal || null,
    detalles || null, emailNormalizado, telefonoNormalizado, username
  ];
  const sql = `UPDATE usuarios SET
    email_verificado = IF(COALESCE(email, '') = COALESCE(?, ''), email_verificado, 0),
    telefono_verificado = IF(COALESCE(telefono, '') = COALESCE(?, ''), telefono_verificado, 0),
    telefono_requerido = IF(? IS NULL, 0, IF(COALESCE(telefono, '') <> COALESCE(?, ''), 1, IF(telefono_verificado = 0, 1, telefono_requerido))),
    nombre = ?, direccion = ?, ciudad = ?, pais = ?, codigo_postal = ?, detalles = ?, email = ?, telefono = ?
    WHERE username = ?`;
  try {
    const duplicado = await db.get(
      'SELECT id FROM usuarios WHERE (LOWER(email) = LOWER(?) OR telefono = ?) AND username <> ? LIMIT 1',
      [emailNormalizado, telefonoNormalizado, username]
    );
    if (duplicado) return res.status(409).json({ error: 'El correo o teléfono ya está asociado a otra cuenta' });
    const usuario = await db.get('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.run(sql, params);
    const actualizado = await db.get(
      'SELECT id, username, email, telefono, nombre, direccion, ciudad, pais, codigo_postal, detalles, foto_url, email_verificado, telefono_verificado, telefono_requerido FROM usuarios WHERE username = ?',
      [username]
    );
    return res.json({ usuario: actualizado });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

router.get('/perfil/:username/foto', (req, res) => {
  db.get(
    'SELECT image_data, image_mime FROM usuarios WHERE username = ?',
    [req.params.username],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error leyendo foto de perfil' });
      if (!row || !row.image_data || !row.image_mime) return res.status(404).json({ error: 'Foto no encontrada' });
      res.set('Cache-Control', 'private, max-age=86400');
      res.type(row.image_mime).send(row.image_data);
    }
  );
});

// Subir foto de perfil (envía JSON { dataUrl }) y guardar sus bytes en MySQL.
router.post('/perfil/:username/foto', (req, res) => {
  const username = req.params.username;
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl requerido' });

  const image = parseImageDataUrl(dataUrl);
  if (!image) return res.status(400).json({ error: 'Imagen inválida o supera el límite de 6 MB' });

  const publicPath = `/usuarios/perfil/${encodeURIComponent(username)}/foto`;
  db.get('SELECT id FROM usuarios WHERE username = ?', [username], (lookupError, usuario) => {
    if (lookupError) return res.status(500).json({ error: 'No se pudo buscar el usuario' });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    db.run(
      'UPDATE usuarios SET image_data = ?, image_mime = ?, foto_url = ? WHERE username = ?',
      [image.buffer, image.mime, publicPath, username],
      (err) => {
        if (err) {
          console.error('Error guardando foto de perfil en MySQL:', err);
          return res.status(500).json({ error: 'No se pudo guardar la foto en la base de datos' });
        }
        res.json({ foto_url: publicPath });
      }
    );
  });
});

module.exports = router;