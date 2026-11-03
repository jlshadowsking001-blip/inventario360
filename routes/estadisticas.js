// ===============================
// Módulo de estadísticas agregadas por rango de tiempo
// ===============================

const express = require('express');
const router = express.Router();
const db = require('../db');

const RANGE_CONFIG = {
    dia: { segments: 5 },
    semana: { segments: 5 },
    mes: { segments: 5 },
    año: { segments: 5 }
};

// Normaliza cadenas de fecha en distintos formatos a un objeto Date UTC
function parseFechaBase(value) {
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

// Ajusta la fecha a los límites válidos del periodo solicitado (día, semana, mes, año)
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

// Suma periodos completos (días, semanas, meses, años) respetando UTC
function addPeriod(date, amount, rango) {
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

// Devuelve una etiqueta legible para el periodo que alimenta la UI
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

// Calcula el número de semana ISO para una fecha determinada
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Convierte valores almacenados en movimientos a Date consistente (timestamp o texto)
function parseMovimientoFecha(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const tryNumeric = (raw) => {
        if (raw === null || raw === undefined) return null;
        const num = Number(raw);
        if (Number.isNaN(num)) return null;
        const isSeconds = Math.abs(num) < 1e12;
        return new Date(isSeconds ? num * 1000 : num);
    };

    const numericDate = tryNumeric(value);
    if (numericDate) return numericDate;

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return new Date(parsed);
    }

    return null;
}

// Construye timeline y totales de ventas para un rango solicitado por el cliente
router.get('/', (req, res) => {
    const rango = req.query.rango || 'dia';
    const fechaBase = req.query.fechaBase;
    const usuarioId = Number(req.query.usuario_id);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        return res.status(400).json({ error: 'usuario_id válido requerido' });
    }
    if (!fechaBase) return res.status(400).json({ error: 'Faltan parámetros' });

    const baseDate = parseFechaBase(fechaBase);
    if (!baseDate || isNaN(baseDate)) return res.status(400).json({ error: 'Fecha inválida' });

    const config = RANGE_CONFIG[rango] || RANGE_CONFIG.dia;
    const alignedBase = alignToPeriod(baseDate, rango);
    const start = addPeriod(alignedBase, -(config.segments - 1), rango);
    const end = addPeriod(alignedBase, 1, rango);
    const timeline = [];
    for (let i = 0; i < config.segments; i++) {
        const periodStart = addPeriod(start, i, rango);
        timeline.push({
            label: formatPeriod(periodStart, rango),
            start: periodStart,
            end: addPeriod(periodStart, 1, rango)
        });
    }

    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);

    const sql = `SELECT m.fecha, m.cantidad, m.monto, p.id as producto_id, p.nombre, p.precio, p.costo
                FROM movimientos m
                JOIN productos p ON m.producto_id = p.id AND p.usuario_id = m.usuario_id
                WHERE m.tipo = 'venta' AND m.usuario_id = ? AND m.fecha BETWEEN ? AND ?`;

    db.all(sql, [usuarioId, startTs, endTs], (err, rows = []) => {
        if (err) {
            console.error('Error en estadísticas:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        const detalleMap = new Map();
        const periodoMap = new Map();
        const productoMap = new Map();
        rows.forEach(row => {
            const fechaMovimiento = parseMovimientoFecha(row.fecha);
            if (!fechaMovimiento) return;
            const periodo = formatPeriod(alignToPeriod(fechaMovimiento, rango), rango);
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