// ===============================
// Módulo de estadísticas agregadas por rango de tiempo
// ===============================

const express = require('express');
const router = express.Router();
const db = require('../db'); // Asegúrate que este sea tu conexión SQLite

/**
 * Ruta: GET /estadisticas
 * Función: Devuelve estadísticas agregadas de ventas por rango de tiempo.
 * Parámetros esperados:
 *   - rango: "dia", "semana", "mes", "año"
 *   - fechaBase: fecha en formato YYYY-MM-DD (usada como referencia)
 */
router.get('/', async (req, res) => {
    const { rango, fechaBase } = req.query;

    // Validación de parámetros
    if (!rango || !fechaBase) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const baseDate = new Date(fechaBase);
    if (isNaN(baseDate)) {
        return res.status(400).json({ error: 'Fecha inválida' });
    }

    // Determinar cómo agrupar los datos según el rango
    let groupBy;
    switch (rango) {
        case 'dia':
        groupBy = "strftime('%Y-%m-%d', m.fecha)";
        break;
        case 'semana':
        groupBy = "strftime('%Y-W%W', m.fecha)";
        break;
        case 'mes':
        groupBy = "strftime('%Y-%m', m.fecha)";
        break;
        case 'año':
        groupBy = "strftime('%Y', m.fecha)";
        break;
        default:
        return res.status(400).json({ error: 'Rango inválido' });
    }

    try {
        // Consulta SQL: agrupa ventas por periodo y producto
        const query = `
        SELECT 
            ${groupBy} AS periodo,               -- Agrupación por fecha
            p.id,                                -- ID del producto
            p.nombre,                            -- Nombre del producto
            SUM(m.cantidad) AS total_unidades,   -- Total de unidades vendidas
            SUM(m.cantidad * p.precio) AS total_monto, -- Total vendido (precio × cantidad)
            SUM(m.cantidad * p.costo) AS total_costo,  -- Costo total (costo × cantidad)
            AVG(p.precio) AS precio_unitario     -- Precio promedio (por si varía)
        FROM movimientos m
        JOIN productos p ON m.producto_id = p.id
        WHERE m.tipo = 'venta'                 -- Solo ventas, no egresos
        GROUP BY periodo, p.id                 -- Agrupar por fecha y producto
        ORDER BY periodo ASC                   -- Orden cronológico
        `;

        const rows = await db.all(query); // Ejecutar consulta
        res.json({ resumen: rows });      // Enviar resultado al frontend
    } catch (err) {
        console.error('Error en estadísticas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;