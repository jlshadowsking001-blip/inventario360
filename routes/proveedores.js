const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar proveedores con el total pendiente por pagar (egresos/gastos asociados)
router.get('/', (_req, res) => {
  const sql = `
    SELECT p.*, COALESCE(t.total_por_pagar, 0) AS total_por_pagar
    FROM proveedores p
    LEFT JOIN (
      SELECT proveedor_id, SUM(COALESCE(monto, 0)) AS total_por_pagar
      FROM movimientos
      WHERE proveedor_id IS NOT NULL AND tipo IN ('gasto', 'egreso')
      GROUP BY proveedor_id
    ) t ON t.proveedor_id = p.id
    ORDER BY p.id DESC`;

  db.all(sql, [], (err, rows = []) => {
    if (err) return res.status(500).json({ error: 'Error leyendo proveedores' });
    const totalProveedores = rows.length;
    const totalPorPagar = rows.reduce((acc, row) => acc + (Number(row.total_por_pagar) || 0), 0);
    res.json({ proveedores: rows, resumen: { totalProveedores, totalPorPagar } });
  });
});

// Crear proveedor
router.post('/', (req, res) => {
  const { nombre, contacto, telefono, email } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  db.run('INSERT INTO proveedores (nombre, contacto, telefono, email) VALUES (?, ?, ?, ?)', [nombre, contacto || null, telefono || null, email || null], function (err) {
    if (err) return res.status(500).json({ error: 'Error creando proveedor' });
    db.get('SELECT * FROM proveedores WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'Creado pero no se pudo leer' });
      res.json({ proveedor: row });
    });
  });
});

// Actualizar proveedor
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, contacto, telefono, email } = req.body;
  db.run('UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, email = ? WHERE id = ?', [nombre || null, contacto || null, telefono || null, email || null, id], function (err) {
    if (err) return res.status(500).json({ error: 'Error actualizando proveedor' });
    if (this.changes === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    db.get('SELECT * FROM proveedores WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Error leyendo proveedor' });
      res.json({ proveedor: row });
    });
  });
});

// Eliminar proveedor
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM proveedores WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando proveedor' });
    if (this.changes === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ mensaje: 'Proveedor eliminado' });
  });
});

module.exports = router;
