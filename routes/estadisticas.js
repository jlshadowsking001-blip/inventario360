// ===============================
// Módulo de estadísticas agregadas por rango de tiempo
// ===============================

const express = require('express');
const router = express.Router();
const db = require('../db');

function formatPeriod(date, rango) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    switch (rango) {
        case 'dia':
            return `${year}-${month}-${day}`;
        case 'semana': {
            const week = getWeekNumber(date);
            return `${year}-W${String(week).padStart(2, '0')}`;
        }
        case 'mes':
            return `${year}-${month}`;
        case 'año':
            return `${year}`;
        default:
            return `${year}-${month}-${day}`;
    }
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

router.get('/', (req, res) => {
    const rango = req.query.rango || 'dia';
    const fechaBase = req.query.fechaBase;
    if (!fechaBase) return res.status(400).json({ error: 'Faltan parámetros' });

    const baseDate = new Date(`${fechaBase}T00:00:00Z`);
    if (isNaN(baseDate)) return res.status(400).json({ error: 'Fecha inválida' });

    const start = new Date(baseDate);
    const end = new Date(baseDate);
    switch (rango) {
        case 'dia':
            end.setUTCDate(end.getUTCDate() + 1);
            break;
        case 'semana':
            end.setUTCDate(end.getUTCDate() + 7);
            break;
        case 'mes':
            end.setUTCMonth(end.getUTCMonth() + 1);
            break;
        case 'año':
            end.setUTCFullYear(end.getUTCFullYear() + 1);
            break;
        default:
            return res.status(400).json({ error: 'Rango inválido' });
    }

    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);

    const sql = `SELECT m.fecha, m.cantidad, m.monto, p.id as producto_id, p.nombre, p.precio, p.costo
                 FROM movimientos m
                 JOIN productos p ON m.producto_id = p.id
                 WHERE m.tipo = 'venta' AND m.fecha BETWEEN ? AND ?`;

    db.all(sql, [startTs, endTs], (err, rows = []) => {
        if (err) {
            console.error('Error en estadísticas:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        const resumenMap = new Map();
        rows.forEach(row => {
            const fecha = new Date((row.fecha || 0) * 1000);
            const periodo = formatPeriod(fecha, rango);
            const key = `${periodo}-${row.producto_id}`;
            if (!resumenMap.has(key)) {
                resumenMap.set(key, {
                    periodo,
                    id: row.producto_id,
                    nombre: row.nombre,
                    total_unidades: 0,
                    total_monto: 0,
                    total_costo: 0,
                    precio_unitario: row.precio || 0
                });
            }
            const bucket = resumenMap.get(key);
            const unidades = Number(row.cantidad) || 0;
            const montoMovimiento = row.monto != null ? Number(row.monto) : (unidades * (row.precio || 0));
            bucket.total_unidades += unidades;
            bucket.total_monto += montoMovimiento;
            bucket.total_costo += unidades * (row.costo || 0);
        });

        const resumen = Array.from(resumenMap.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
        res.json({ resumen });
    });
});

module.exports = router;