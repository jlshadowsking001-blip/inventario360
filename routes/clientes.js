const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar clientes
router.get('/', (_req, res) => {
  db.all('SELECT * FROM clientes ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error leyendo clientes' });
    res.json({ clientes: rows });
  });
});

// Crear cliente
router.post('/', (req, res) => {
  const { nombre, direccion, telefono, email } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  db.run('INSERT INTO clientes (nombre, direccion, telefono, email) VALUES (?, ?, ?, ?)', [nombre, direccion || null, telefono || null, email || null], function (err) {
    if (err) return res.status(500).json({ error: 'Error creando cliente' });
    db.get('SELECT * FROM clientes WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
      res.json({ cliente: row });
    });
  });
});

// Actualizar cliente
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, direccion, telefono, email } = req.body;
  db.run('UPDATE clientes SET nombre = ?, direccion = ?, telefono = ?, email = ? WHERE id = ?', [nombre || null, direccion || null, telefono || null, email || null, id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando cliente' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    db.get('SELECT * FROM clientes WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo cliente' });
      res.json({ cliente: row });
    });
  });
});

// Eliminar cliente
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM clientes WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando cliente' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ mensaje: 'Cliente eliminado' });
  });
});

module.exports = router;
