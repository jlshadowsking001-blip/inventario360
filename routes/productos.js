const express = require('express');
const router = express.Router();
const db = require('../db');
const { parseImageDataUrl } = require('../servicios/imagenes');

const productWithImageUrl = (row, usuario_id) => {
  const { image_data, image_mime, ...producto } = row;
  if (image_mime) {
    const imageVersion = row.updated_at || row.created_at || 0;
    producto.image_url = `/productos/${row.id}/imagen?usuario_id=${encodeURIComponent(usuario_id)}&v=${imageVersion}`;
  }
  return producto;
};

// Devuelve todos los productos junto con la categoría asociada
router.get('/', (req, res)=>{
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.all(
    `SELECT p.id, p.nombre, p.descripcion, p.precio, p.costo, p.existencia, p.categoria_id, p.image_url, p.image_mime, p.created_at, p.updated_at, c.nombre as categoria
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id AND c.usuario_id = ?
      WHERE p.usuario_id = ?`,
    [usuario_id, usuario_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error leyendo productos' });
      res.json({ productos: rows.map(row => productWithImageUrl(row, usuario_id)) });
    }
  );
});

router.get('/:id/imagen', (req, res) => {
  const { id } = req.params;
  const usuario_id = req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });

  db.get(
    'SELECT image_data, image_mime FROM productos WHERE id = ? AND usuario_id = ?',
    [id, usuario_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error leyendo imagen del producto' });
      if (!row || !row.image_data || !row.image_mime) return res.status(404).json({ error: 'Imagen no encontrada' });
      res.set('Cache-Control', 'private, no-store');
      res.type(row.image_mime).send(row.image_data);
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
    res.json({ producto: productWithImageUrl(row, usuario_id) });
  });
});

// Crea un producto nuevo y guarda la imagen enviada en base64 si existe
router.post('/', (req, res)=>{
  const { nombre, descripcion, precio, costo, existencia, categoria_id, dataUrl, usuario_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (precio < 0 || costo < 0 || existencia < 0) return res.status(400).json({ error: 'Valores no pueden ser negativos' });

  const image = dataUrl ? parseImageDataUrl(dataUrl) : null;
  if (dataUrl && !image) return res.status(400).json({ error: 'Imagen inválida o supera el límite de 15 MB' });

  db.run(
    `INSERT INTO productos (nombre, descripcion, precio, costo, existencia, categoria_id, image_url, image_data, image_mime, created_at, usuario_id) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, UNIX_TIMESTAMP(), ?)`,
    [nombre, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, image ? image.buffer : null, image ? image.mime : null, usuario_id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error creando producto' });
      db.get('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [this.lastID, usuario_id], (e, row) => {
        if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
        res.json({ producto: productWithImageUrl(row, usuario_id) });
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
    db.get('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ producto: productWithImageUrl(row, usuario_id) });
    });
  });
});

// Permite actualizar campos puntuales del producto y subir una nueva imagen
router.patch('/:id', (req, res)=>{
  const id = req.params.id;
  const fields = [];
  const values = [];
  const usuario_id = req.body.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  for (const campo of ['precio', 'costo', 'existencia']) {
    if (req.body[campo] === undefined) continue;
    const valor = req.body[campo];
    if (valor === null || valor === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0) {
      return res.status(400).json({ error: 'El precio, costo y existencia deben ser valores no negativos' });
    }
  }
  ['precio', 'existencia', 'nombre', 'descripcion', 'costo', 'categoria_id'].forEach(k => {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(req.body[k]);
    }
  });
  let image = null;
  if (req.body.dataUrl !== undefined) {
    image = parseImageDataUrl(req.body.dataUrl);
    if (!image) return res.status(400).json({ error: 'Imagen inválida o supera el límite de 15 MB' });
    fields.push('image_data = ?', 'image_mime = ?', 'image_url = NULL');
    values.push(image.buffer, image.mime);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });
  const shouldStampUpdate = ['existencia', 'precio', 'costo'].some(k => req.body[k] !== undefined) || Boolean(image);
  if (shouldStampUpdate) {
    fields.push("updated_at = UNIX_TIMESTAMP()");
  }
  values.push(id, usuario_id);
  const sql = `UPDATE productos SET ${fields.join(', ')} WHERE id = ? AND usuario_id = ?`;
  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando producto' });
    db.get('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo producto actualizado' });
      if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ producto: productWithImageUrl(row, usuario_id) });
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
