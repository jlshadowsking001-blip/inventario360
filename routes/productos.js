const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

// asegurar carpeta de uploads
const uploadDir = path.join(__dirname, '..', 'publico', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Decodifica un dataUrl base64 y lo persiste en disco devolviendo la ruta pública
const saveImageFromDataUrl = (name, dataUrlValue) => {
  const matches = typeof dataUrlValue === 'string' && dataUrlValue.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
  const base64Data = matches[3];
  const safeName = (name || 'prod').replace(/[^a-z0-9_-]/gi,'');
  const filename = `${safeName || 'prod'}_${Date.now()}.${ext}`;
  const filepath = path.join(uploadDir, filename);
  try {
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error guardando imagen de producto:', err);
    return null;
  }
};

// Devuelve todos los productos junto con la categoría asociada
router.get('/', (req, res)=>{
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.all(
    `SELECT p.id, p.nombre, p.descripcion, p.precio, p.costo, p.existencia, p.categoria_id, p.image_url, p.created_at, p.updated_at, c.nombre as categoria
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id AND c.usuario_id = ?
      WHERE p.usuario_id = ?`,
    [usuario_id, usuario_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error leyendo productos' });
      res.json({ productos: rows });
    }
  );
});

// Recupera un producto específico por ID para vistas de detalle/edición
router.get('/:id', (req, res)=>{
  const id = req.params.id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.get('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error leyendo producto' });
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ producto: row });
  });
});

// Crea un producto nuevo y guarda la imagen enviada en base64 si existe
router.post('/', (req, res)=>{
  const { nombre, descripcion, precio, costo, existencia, categoria_id, dataUrl, usuario_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (precio < 0 || costo < 0 || existencia < 0) return res.status(400).json({ error: 'Valores no pueden ser negativos' });

  let image_url = null;
  if (dataUrl) {
    image_url = saveImageFromDataUrl(nombre, dataUrl);
    if (!image_url) return res.status(400).json({ error: 'Formato de imagen inválido' });
  }

  db.run(
    `INSERT INTO productos (nombre, descripcion, precio, costo, existencia, categoria_id, image_url, created_at, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), ?)`,
    [nombre, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, image_url, usuario_id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error creando producto' });
      db.get('SELECT * FROM productos WHERE id = ?', [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
        res.json({ producto: row });
      });
    }
  );
});

// Reemplaza todos los campos del producto y actualiza marca de tiempo
router.put('/:id', (req, res)=>{
  const id = req.params.id;
  const { nombre, descripcion, precio, costo, existencia, categoria_id, usuario_id } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (precio < 0 || costo < 0 || existencia < 0) return res.status(400).json({ error: 'Valores no pueden ser negativos' });
  const sql = `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, costo = ?, existencia = ?, categoria_id = ?, updated_at = UNIX_TIMESTAMP() WHERE id = ? AND usuario_id = ?`;
  db.run(sql, [nombre, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, id, usuario_id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    db.get('SELECT * FROM productos WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      res.json({ producto: row });
    });
  });
});

// Permite actualizar campos puntuales del producto y subir una nueva imagen
router.patch('/:id', (req, res)=>{
  const id = req.params.id;
  const fields = [];
  const values = [];
  ['precio', 'existencia', 'nombre', 'descripcion', 'costo', 'categoria_id'].forEach(k => {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(req.body[k]);
    }
  });
  let newImageUrl = null;
  if (req.body.dataUrl) {
    newImageUrl = saveImageFromDataUrl(req.body.nombre, req.body.dataUrl);
    if (!newImageUrl) return res.status(400).json({ error: 'Formato de imagen inválido' });
    fields.push('image_url = ?');
    values.push(newImageUrl);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });
  const shouldStampUpdate = ['existencia', 'precio', 'costo'].some(k => req.body[k] !== undefined) || Boolean(newImageUrl);
  if (shouldStampUpdate) {
    fields.push("updated_at = UNIX_TIMESTAMP()");
  }
  values.push(id);
  const sql = `UPDATE productos SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    db.get('SELECT * FROM productos WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      res.json({ producto: row });
    });
  });
});

// Elimina un producto y devuelve error si el registro no existía
router.delete('/:id', (req, res)=>{
  const id = req.params.id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.run('DELETE FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  });
});

module.exports = router;
