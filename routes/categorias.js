const express = require('express');
const router = express.Router();
const db = require('../db');

// Devuelve todas las categorías ordenadas alfabéticamente para poblar selects en frontend
router.get('/', (req, res) => {
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.all('SELECT id, nombre FROM categorias WHERE usuario_id = ? ORDER BY nombre', [usuario_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error leyendo categorías' });
    res.json({ categorias: rows });
  });
});

// Inserta una nueva categoría y devuelve el registro recién creado
router.post('/', (req, res) => {
  const { nombre, usuario_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.run('INSERT INTO categorias (nombre, usuario_id) VALUES (?, ?)', [nombre, usuario_id], function (err) {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Categoría ya existe' });
      return res.status(500).json({ error: 'Error creando categoría' });
    }
    db.get('SELECT id, nombre FROM categorias WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
      res.json({ categoria: row });
    });
  });
});

// Actualiza el nombre de una categoría existente y responde con el recurso final
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, usuario_id } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.run('UPDATE categorias SET nombre = ? WHERE id = ? AND usuario_id = ?', [nombre, id, usuario_id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando categoría' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    db.get('SELECT id, nombre FROM categorias WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo categoría' });
      res.json({ categoria: row });
    });
  });
});

// Elimina una categoría por ID e informa si no existía
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.run('DELETE FROM categorias WHERE id = ? AND usuario_id = ?', [id, usuario_id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando categoría' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ mensaje: 'Categoría eliminada' });
  });
});

module.exports = router;
