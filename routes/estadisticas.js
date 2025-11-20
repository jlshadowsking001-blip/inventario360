// ===============================
// Módulo de estadísticas agregadas por rango de tiempo
// ===============================

const express = require('express');
const router = express.Router();
const db = require('../db');

const RANGE_CONFIG = {
    dia: { segments: 7 },
    semana: { segments: 6 },
    mes: { segments: 6 },
    año: { segments: 5 }
};

function alignToPeriod(date, rango) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    switch (rango) {
        case 'semana': {
            const day = d.getUTCDay() || 7; // ISO week (Monday = 1)
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

function addPeriod(date, rango, amount) {
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

    const config = RANGE_CONFIG[rango] || RANGE_CONFIG.dia;
    let start;
    let end;
    const timeline = [];

    if (rango === 'dia') {
        start = alignToPeriod(baseDate, 'semana');
        end = addPeriod(start, config.segments, 'dia');
        for (let i = 0; i < config.segments; i++) {
            const dayStart = addPeriod(start, i, 'dia');
            timeline.push({
                label: formatPeriod(dayStart, 'dia'),
                start: dayStart,
                end: addPeriod(dayStart, 1, 'dia')
            });
        }
    } else {
        const alignedBase = alignToPeriod(baseDate, rango);
        start = addPeriod(alignedBase, -(config.segments - 1), rango);
        end = addPeriod(alignedBase, 1, rango);
        for (let i = 0; i < config.segments; i++) {
            const periodStart = addPeriod(start, i, rango);
            timeline.push({
                label: formatPeriod(periodStart, rango),
                start: periodStart,
                end: addPeriod(periodStart, 1, rango)
            });
        }
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

        const detalleMap = new Map();
        const periodoMap = new Map();
        const productoMap = new Map();
        rows.forEach(row => {
            const fecha = new Date((row.fecha || 0) * 1000);
            const periodo = formatPeriod(alignToPeriod(fecha, rango), rango);
            const key = `${periodo}-${row.producto_id}`;
            if (!detalleMap.has(key)) {
                detalleMap.set(key, {
                    periodo,
                    id: row.producto_id,
                    nombre: row.nombre,
                    total_unidades: 0,
                    total_monto: 0,
                    total_costo: 0,
                    precio_unitario: row.precio || 0
                });
            }
            const bucket = detalleMap.get(key);
            const unidades = Number(row.cantidad) || 0;
            const montoMovimiento = row.monto != null ? Number(row.monto) : (unidades * (row.precio || 0));
            bucket.total_unidades += unidades;
            bucket.total_monto += montoMovimiento;
            bucket.total_costo += unidades * (row.costo || 0);

            if (!periodoMap.has(periodo)) {
                periodoMap.set(periodo, {
                    periodo,
                    total_unidades: 0,
                    total_monto: 0,
                    total_costo: 0
                });
            }
            const periodoBucket = periodoMap.get(periodo);
            periodoBucket.total_unidades += unidades;
            periodoBucket.total_monto += montoMovimiento;
            periodoBucket.total_costo += unidades * (row.costo || 0);

            if (!productoMap.has(row.producto_id)) {
                productoMap.set(row.producto_id, {
                    id: row.producto_id,
                    nombre: row.nombre,
                    total_unidades: 0,
                    total_monto: 0,
                    total_costo: 0
                });
            }
            const productoBucket = productoMap.get(row.producto_id);
            productoBucket.total_unidades += unidades;
            productoBucket.total_monto += montoMovimiento;
            productoBucket.total_costo += unidades * (row.costo || 0);
        });

        const periodos = timeline.map(item => {
            const bucket = periodoMap.get(item.label) || { periodo: item.label, total_unidades: 0, total_monto: 0, total_costo: 0 };
            return {
                periodo: item.label,
                total_unidades: bucket.total_unidades,
                total_monto: bucket.total_monto,
                total_costo: bucket.total_costo,
                ganancia: (bucket.total_monto || 0) - (bucket.total_costo || 0)
            };
        });

        const productos = Array.from(productoMap.values()).sort((a, b) => (b.total_monto || 0) - (a.total_monto || 0));
        const resumen = Array.from(detalleMap.values()).sort((a, b) => {
            const per = a.periodo.localeCompare(b.periodo);
            return per !== 0 ? per : a.nombre.localeCompare(b.nombre);
        });

        res.json({ resumen, periodos, productos });
    });
});

module.exports = router;