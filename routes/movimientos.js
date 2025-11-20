const express = require('express');
const router = express.Router();
const db = require('../db');

// Registrar un movimiento (venta/egreso/ajuste)
router.post('/', (req, res) => {
  const { tipo, producto_id, cantidad, monto, descripcion, cliente_id, proveedor_id } = req.body;
  if (!tipo || (tipo === 'venta' && (!producto_id || !cantidad))) {
    return res.status(400).json({ error: 'tipo y (producto_id,cantidad) para venta son requeridos' });
  }

  if (tipo === 'gasto' && (!monto || Number(monto) <= 0)) {
    return res.status(400).json({ error: 'El monto del gasto es obligatorio' });
  }

  // Si es venta y no se indicó monto calculamos usando el precio actual
  const doInsertMovimiento = (finalMonto) => {
    db.run(
      'INSERT INTO movimientos (tipo, producto_id, cantidad, monto, descripcion, fecha, cliente_id, proveedor_id) VALUES (?, ?, ?, ?, ?, strftime("%s","now"), ?, ?)',
      [tipo, producto_id || null, cantidad || 0, finalMonto || 0, descripcion || null, cliente_id || null, proveedor_id || null],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error registrando movimiento' });
        res.json({ mensaje: 'Movimiento registrado', id: this.lastID });
      }
    );
  };

  if (tipo === 'venta') {
    // Leer producto para obtener precio y existencia
    db.get('SELECT existencia, precio FROM productos WHERE id = ?', [producto_id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Error leyendo producto' });
      if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
      if (row.existencia < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

      const finalMonto = monto || (row.precio * cantidad);

      // Actualizar existencia
      db.run('UPDATE productos SET existencia = existencia - ? WHERE id = ?', [cantidad, producto_id], function (uerr) {
        if (uerr) return res.status(500).json({ error: 'Error actualizando stock' });
        doInsertMovimiento(finalMonto);
      });
    });
  } else if (tipo === 'gasto') {
    doInsertMovimiento(monto);
  } else {
    // Otros tipos: egreso/ajuste sólo insertan movimiento (puede afectar stock si se desea)
    if (tipo === 'egreso' && producto_id && cantidad) {
      // disminuir stock también
      db.run('UPDATE productos SET existencia = existencia - ? WHERE id = ?', [cantidad, producto_id], function (uerr) {
        if (uerr) return res.status(500).json({ error: 'Error actualizando stock' });
        doInsertMovimiento(monto);
      });
    } else {
      doInsertMovimiento(monto);
    }
  }
});

// Listar movimientos con filtros opcionales por tipo, producto
// y potencialmente por fecha si el cliente envía esos parámetros.
router.get('/', (req, res) => {
  const { tipo, producto_id } = req.query;
  let sql = 'SELECT m.*, p.nombre as producto, c.nombre as cliente, pr.nombre as proveedor FROM movimientos m LEFT JOIN productos p ON m.producto_id = p.id LEFT JOIN clientes c ON m.cliente_id = c.id LEFT JOIN proveedores pr ON m.proveedor_id = pr.id';
  const params = [];
  const where = [];
  if (tipo) { where.push('m.tipo = ?'); params.push(tipo); }
  if (producto_id) { where.push('m.producto_id = ?'); params.push(producto_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY fecha DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error leyendo movimientos' });
    res.json({ movimientos: rows });
  });
});

// Estadísticas: resumen ventas por producto y totales
router.get('/estadisticas/resumen', (req, res) => {
  const sql = `SELECT p.id, p.nombre, SUM(m.cantidad) as total_unidades, SUM(m.monto) as total_monto
                FROM movimientos m
                JOIN productos p ON m.producto_id = p.id
                WHERE m.tipo = 'venta'
                GROUP BY p.id, p.nombre
                ORDER BY total_monto DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error calculando estadísticas' });
    // totales generales
    db.get("SELECT SUM(monto) as total_ingresos, SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END) as total_egresos FROM movimientos", [], (e, totals) => {
      if (e) return res.status(500).json({ error: 'Error calculando totales' });
      res.json({ resumen: rows, totales: totals });
    });
  });
});

module.exports = router;
