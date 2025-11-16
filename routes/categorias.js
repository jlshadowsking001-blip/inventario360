const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar categorías
router.get('/', (_req, res) => {
  db.all('SELECT id, nombre FROM categorias ORDER BY nombre', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error leyendo categorías' });
    res.json({ categorias: rows });
  });
});

// Crear categoría
router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  db.run('INSERT INTO categorias (nombre) VALUES (?)', [nombre], function (err) {
    if (err) return res.status(500).json({ error: 'Error creando categoría' });
    db.get('SELECT id, nombre FROM categorias WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
      res.json({ categoria: row });
    });
  });
});

// Actualizar categoría
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nombre } = req.body;
  db.run('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre, id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando categoría' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    db.get('SELECT id, nombre FROM categorias WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo categoría' });
      res.json({ categoria: row });
    });
  });
});

// Eliminar categoría
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM categorias WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando categoría' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ mensaje: 'Categoría eliminada' });
  });
});

module.exports = router;
