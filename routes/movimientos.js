const express = require('express');
const router = express.Router();
const db = require('../db');
const VALID_RANGOS = new Set(['dia', 'semana', 'mes', 'año']);

// Convierte distintas representaciones de fecha en un objeto Date válido
function parseFechaFiltro(value) {
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const localMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (localMatch) {
    const [, d, m, y] = localMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

// Ajusta la fecha al inicio del periodo indicado para comparar rangos
function alignToPeriodo(date, rango) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  switch (rango) {
    case 'semana': {
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 1 - day);
      return d;
    }
    case 'mes':
      d.setUTCDate(1);
      return d;
    case 'año':
      d.setUTCMonth(0, 1);
      return d;
    case 'dia':
    default:
      return d;
  }
}

// Suma unidades de periodo completas a una fecha dada respetando UTC
function addPeriodo(date, amount, rango) {
  const d = new Date(date.getTime());
  switch (rango) {
    case 'semana':
      d.setUTCDate(d.getUTCDate() + (amount * 7));
      break;
    case 'mes':
      d.setUTCMonth(d.getUTCMonth() + amount);
      break;
    case 'año':
      d.setUTCFullYear(d.getUTCFullYear() + amount);
      break;
    case 'dia':
    default:
      d.setUTCDate(d.getUTCDate() + amount);
      break;
  }
  return d;
}

// Registra movimientos de inventario/finanzas y actualiza stock si corresponde
router.post('/', (req, res) => {
  const { tipo, producto_id, cantidad, monto, descripcion, cliente_id, proveedor_id, es_credito } = req.body;
  const usuarioId = Number(req.body.usuario_id);
  const fechaMovimiento = req.body.fecha;
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({ error: 'usuario_id válido requerido' });
  }
  let fechaTimestamp = Math.floor(Date.now() / 1000);
  if (fechaMovimiento !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaMovimiento);
    if (!match) return res.status(400).json({ error: 'Fecha inválida' });
    const [, year, month, day] = match;
    const parsedFecha = new Date(0);
    // Guarda al mediodía UTC para que la fecha siga coincidiendo al mostrarla en zonas horarias locales.
    parsedFecha.setUTCHours(12, 0, 0, 0);
    parsedFecha.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (parsedFecha.toISOString().slice(0, 10) !== fechaMovimiento) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    fechaTimestamp = Math.floor(parsedFecha.getTime() / 1000);
  }
  if (!tipo || (tipo === 'venta' && (!producto_id || !cantidad))) {
    return res.status(400).json({ error: 'tipo y (producto_id,cantidad) para venta son requeridos' });
  }

  if (tipo === 'gasto' && (!monto || Number(monto) <= 0)) {
    return res.status(400).json({ error: 'El monto del gasto es obligatorio' });
  }

  const esCredito = (tipo === 'venta' && Number(es_credito)) ? 1 : 0;

  // Si es venta y no se indicó monto calculamos usando el precio actual
  const doInsertMovimiento = (finalMonto) => {
    db.run(
      'INSERT INTO movimientos (tipo, producto_id, cantidad, monto, descripcion, fecha, cliente_id, proveedor_id, es_credito, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tipo, producto_id || null, cantidad || 0, finalMonto || 0, descripcion || null, fechaTimestamp, cliente_id || null, proveedor_id || null, esCredito, usuarioId],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error registrando movimiento' });
        res.json({ mensaje: 'Movimiento registrado', id: this.lastID });
      }
    );
  };

  const referencias = [
    ['clientes', cliente_id],
    ['proveedores', proveedor_id]
  ];
  if (tipo !== 'venta' && producto_id) referencias.push(['productos', producto_id]);

  const registrarMovimiento = () => {
    if (tipo === 'venta') {
      // Verifica que el producto pertenezca al usuario antes de consultar o reducir su inventario.
      db.get('SELECT existencia, precio FROM productos WHERE id = ? AND usuario_id = ?', [producto_id, usuarioId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error leyendo producto' });
        if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
        if (row.existencia < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

        const finalMonto = monto || (row.precio * cantidad);

        // Actualizar existencia
        db.run('UPDATE productos SET existencia = existencia - ? WHERE id = ? AND usuario_id = ? AND existencia >= ?', [cantidad, producto_id, usuarioId, cantidad], function (uerr) {
          if (uerr) return res.status(500).json({ error: 'Error actualizando stock' });
          if (this.changes === 0) return res.status(400).json({ error: 'Stock insuficiente o producto no disponible' });
          doInsertMovimiento(finalMonto);
        });
      });
    } else if (tipo === 'gasto') {
      doInsertMovimiento(monto);
    } else {
      // Otros tipos: egreso/ajuste sólo insertan movimiento (puede afectar stock si se desea)
      if (tipo === 'egreso' && producto_id && cantidad) {
        db.run('UPDATE productos SET existencia = existencia - ? WHERE id = ? AND usuario_id = ?', [cantidad, producto_id, usuarioId], function (uerr) {
          if (uerr) return res.status(500).json({ error: 'Error actualizando stock' });
          if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
          doInsertMovimiento(monto);
        });
      } else {
        doInsertMovimiento(monto);
      }
    }
  }

  const validarReferencia = (indice) => {
    if (indice >= referencias.length) return registrarMovimiento();
    const [tabla, id] = referencias[indice];
    if (!id) return validarReferencia(indice + 1);
    db.get(`SELECT id FROM ${tabla} WHERE id = ? AND usuario_id = ?`, [id, usuarioId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Error validando datos del movimiento' });
      if (!row) return res.status(404).json({ error: 'Referencia no encontrada para este usuario' });
      validarReferencia(indice + 1);
    });
  };
  validarReferencia(0);
});

// Lista movimientos con filtros opcionales por tipo, producto y rango temporal
router.get('/', (req, res) => {
  const { tipo, producto_id, fechaBase, rango } = req.query;
  const usuarioId = Number(req.query.usuario_id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({ error: 'usuario_id válido requerido' });
  }
  let rangoFiltro = null;
  if (fechaBase) {
    const baseDate = parseFechaFiltro(fechaBase);
    if (baseDate && !Number.isNaN(baseDate.valueOf())) {
      const rangoValido = VALID_RANGOS.has(rango) ? rango : 'dia';
      const inicio = alignToPeriodo(baseDate, rangoValido);
      const fin = addPeriodo(inicio, 1, rangoValido);
      rangoFiltro = {
        start: Math.floor(inicio.getTime() / 1000),
        end: Math.floor(fin.getTime() / 1000)
      };
    }
  }
  let sql = 'SELECT m.*, p.nombre as producto, c.nombre as cliente, pr.nombre as proveedor FROM movimientos m LEFT JOIN productos p ON m.producto_id = p.id AND p.usuario_id = m.usuario_id LEFT JOIN clientes c ON m.cliente_id = c.id AND c.usuario_id = m.usuario_id LEFT JOIN proveedores pr ON m.proveedor_id = pr.id AND pr.usuario_id = m.usuario_id';
  const params = [usuarioId];
  const where = ['m.usuario_id = ?'];
  if (tipo) { where.push('m.tipo = ?'); params.push(tipo); }
  if (producto_id) { where.push('m.producto_id = ?'); params.push(producto_id); }
  if (rangoFiltro) {
    where.push('m.fecha >= ? AND m.fecha < ?');
    params.push(rangoFiltro.start, rangoFiltro.end);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY fecha DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error leyendo movimientos' });
    res.json({ movimientos: rows });
  });
});

// Calcula totales vendidos por producto y cifras generales de ingresos/egresos
router.get('/estadisticas/resumen', (req, res) => {
  const usuarioId = Number(req.query.usuario_id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({ error: 'usuario_id válido requerido' });
  }
  const sql = `SELECT p.id, p.nombre, SUM(m.cantidad) as total_unidades, SUM(m.monto) as total_monto
                FROM movimientos m
                JOIN productos p ON m.producto_id = p.id AND p.usuario_id = m.usuario_id
                WHERE m.tipo = 'venta' AND m.usuario_id = ?
                GROUP BY p.id, p.nombre
                ORDER BY total_monto DESC`;
  db.all(sql, [usuarioId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error calculando estadísticas' });
    // totales generales
    db.get("SELECT SUM(monto) as total_ingresos, SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END) as total_egresos FROM movimientos WHERE usuario_id = ?", [usuarioId], (e, totals) => {
      if (e) return res.status(500).json({ error: 'Error calculando totales' });
      res.json({ resumen: rows, totales: totals });
    });
  });
});

module.exports = router;
