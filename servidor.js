const express = require('express');
const path = require('path');
const cors = require('cors');
const inventario360 = express();
const PORT = process.env.PORT || 3001; // puerto configurable por env
// ALLOWED_ORIGINS puede ser una lista separada por comas (ej: https://midominio.com,http://localhost:3001)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [`http://localhost:${PORT}`];

// --- HANDLERS GLOBALES PARA CAPTURAR ERRORES Y DIAGNOSTICAR DEBUGGER ---
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
    // No forzamos exit inmediato cuando estamos en desarrollo con debugger
});
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});

// Imprimir flags de arranque para diagnosticar si el inspector/debugger está activo
try {
    console.log('Node execArgv:', process.execArgv);
    console.log('NODE_OPTIONS:', process.env.NODE_OPTIONS || '<none>');
} catch (e) {
    // no crítico
}


// Middleware
// Servir contenido estático
inventario360.use(express.static(path.join(__dirname,'publico')));
// Limitar CORS sólo a localhost (evita peticiones desde orígenes externos)
// Configurar CORS de forma segura según ALLOWED_ORIGINS
// CORS: permitir orígenes locales comunes y los configurados en ALLOWED_ORIGINS.
// Esto hace la experiencia de desarrollo más flexible (localhost, 127.0.0.1, y el origin configurado).
inventario360.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        try {
            const u = new URL(origin);
            const hostname = u.hostname;
            // permitir localhost y 127.0.0.1 en desarrollo
            if (hostname === 'localhost' || hostname === '127.0.0.1') return callback(null, true);
        } catch (e) {
            // si origin no es parseable, no bloquear de inmediato
        }
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'));
    }
}));
// permitir payloads más grandes para imágenes en dataUrl (ajustar según necesidades)
inventario360.use(express.json({ limit: '10mb' }));
inventario360.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger simple de peticiones para depuración
inventario360.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    // mostrar body sólo en desarrollo/depuración
    if (req.method === 'POST' || req.method === 'PUT') {
        try { console.log('[REQ BODY]', req.body); } catch (e) { }
    }
    next();
});

// Rutas 
inventario360.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, 'publico', 'login.html'));
});
//usuarios
const rutasusuarios = require('./routes/usuarios');
inventario360.use('/usuarios',rutasusuarios);
// Routers adicionales
const productosRoutes = require('./routes/productos');
const movimientosRoutes = require('./routes/movimientos');
inventario360.use('/productos', productosRoutes);
inventario360.use('/movimientos', movimientosRoutes);
// Categorías
const categoriasRoutes = require('./routes/categorias');
inventario360.use('/categorias', categoriasRoutes);
// estadisticas
const estadisticasRouter = require('./routes/estadisticas');
inventario360.use('/estadisticas', estadisticasRouter);
// Clientes y proveedores
const clientesRoutes = require('./routes/clientes');
const proveedoresRoutes = require('./routes/proveedores');
inventario360.use('/clientes', clientesRoutes);
inventario360.use('/proveedores', proveedoresRoutes);

//iniciar servidor
// En producción normalmente escuchamos en 0.0.0.0 (todas las interfaces) para que la plataforma/host pueda exponerlo.
// Plataformas como Render/Railway/Heroku suministran el PORT vía env y manejan TLS/proxy.
// Handler de errores simple para devolver JSON en caso de errores (incluye rechazos CORS)
// Middleware de manejo de errores (firmado con 4 parámetros para que Express lo reconozca)
inventario360.use((err, req, res, next) => {
    console.error('Error en middleware:', err && err.message ? err.message : err);
    if (err && String(err.message || '').toLowerCase().includes('origen')) {
        return res.status(403).json({ error: err.message || 'Origen no permitido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Crear servidor HTTP y escuchar en PORT (y opcionalmente en PORT2)
const http = require('http');
const server = http.createServer(inventario360);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend corriendo en http://0.0.0.0:${PORT} (bind 0.0.0.0)`);
});

const SECOND_PORT = process.env.PORT2;
if (SECOND_PORT) {
    const server2 = http.createServer(inventario360);
    server2.listen(SECOND_PORT, '0.0.0.0', () => {
        console.log(`Servidor adicional corriendo en http://0.0.0.0:${SECOND_PORT} (bind 0.0.0.0)`);
    });
}

