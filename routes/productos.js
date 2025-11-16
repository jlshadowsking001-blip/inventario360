const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

// asegurar carpeta de uploads
const uploadDir = path.join(__dirname, '..', 'publico', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Listar productos
router.get('/', (_req, res)=>{
  db.all(
    `SELECT p.id, p.nombre, p.descripcion, p.precio, p.costo, p.existencia, p.categoria_id, p.image_url, c.nombre as categoria
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error leyendo productos' });
      res.json({ productos: rows });
    }
  );
});

// Obtener producto por id
router.get('/:id', (req, res)=>{
  const id = req.params.id;
  db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error leyendo producto' });
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ producto: row });
  });
});

// Crear producto. Se acepta opcionalmente 'dataUrl' (base64) para la imagen en el body JSON.
router.post('/', (req, res)=>{
  const { nombre, descripcion, precio, costo, existencia, categoria_id, dataUrl } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });

  const saveImageFromDataUrl = (usernameLike, dataUrlValue) => {
    // dataUrl example: data:image/png;base64,AAAABBBB...
    const matches = typeof dataUrlValue === 'string' && dataUrlValue.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
    if (!matches) return null;
    const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
    const base64Data = matches[3];
    const filename = `${(usernameLike || 'prod').replace(/[^a-z0-9_-]/gi,'')}_${Date.now()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    try {
      fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
      return `/uploads/${filename}`;
    } catch (err) {
      console.error('Error guardando imagen de producto:', err);
      return null;
    }
  };

  let image_url = null;
  if (dataUrl) {
    image_url = saveImageFromDataUrl(nombre, dataUrl);
  }

  db.run(
    `INSERT INTO productos (nombre, descripcion, precio, costo, existencia, categoria_id, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))`,
    [nombre, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, image_url],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error creando producto' });
      db.get('SELECT * FROM productos WHERE id = ?', [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
        res.json({ producto: row });
      });
    }
  );
});

// Actualizar producto (completo)
router.put('/:id', (req, res)=>{
  const id = req.params.id;
  const { nombre, descripcion, precio, costo, existencia, categoria_id } = req.body;
  const sql = `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, costo = ?, existencia = ?, categoria_id = ?, updated_at = strftime('%s','now') WHERE id = ?`;
  db.run(sql, [nombre, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    db.get('SELECT * FROM productos WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      res.json({ producto: row });
    });
  });
});

// Actualizar parcialmente (precio, existencia)
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
  if (fields.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });
  values.push(id);
  const sql = `UPDATE productos SET ${fields.join(', ')}, updated_at = strftime('%s','now') WHERE id = ?`;
  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    db.get('SELECT * FROM productos WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      res.json({ producto: row });
    });
  });
});

// Eliminar producto
router.delete('/:id', (req, res)=>{
  const id = req.params.id;
  db.run('DELETE FROM productos WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  });
});

module.exports = router;
