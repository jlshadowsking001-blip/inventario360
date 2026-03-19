const mysql = require('mysql2/promise');

const MYSQL_HOST = process.env.MYSQL_HOST || process.env.MYSQLHOST || process.env.DB_HOST || process.env.MYSQL_HOSTNAME;
const MYSQL_PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : (process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : undefined);
const MYSQL_USER = process.env.MYSQL_USER || process.env.MYSQLUSER || process.env.MYSQL_ROOT_USER || process.env.MYSQLUSERNAME;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLPWORD;
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || process.env.MYSQL_DB;

if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_DATABASE) {
    throw new Error('Faltan variables de entorno de MySQL: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_DATABASE (verifica que estén correctas)');
}

// Función que crea la base de datos (si no existe) antes de levantar el pool de conexiones.
async function ensureDatabaseExists() {
    const connection = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.end();
    console.log(`Base de datos MySQL ${MYSQL_DATABASE} verificada/creada`);
}

// Traducción ligera de consultas heredadas que usaban strftime
// Función que convierte expresiones SQLite strftime en equivalentes MySQL.
const translateSql = (query) => {
    if (typeof query !== 'string' || !query.includes('strftime')) return query;
    let converted = query;
    converted = converted.replace(/strftime\((['"])%s\1,\s*(['"])now\2\)/gi, 'UNIX_TIMESTAMP()');
    converted = converted.replace(/strftime\((['"])%Y-%m-%d\1,\s*([^ )]+)\)/gi, 'DATE_FORMAT(FROM_UNIXTIME($2), \'%Y-%m-%d\')');
    converted = converted.replace(/strftime\((['"])%Y-W%W\1,\s*([^ )]+)\)/gi, 'DATE_FORMAT(FROM_UNIXTIME($2), \'%x-W%v\')');
    converted = converted.replace(/strftime\((['"])%Y-%m\1,\s*([^ )]+)\)/gi, 'DATE_FORMAT(FROM_UNIXTIME($2), \'%Y-%m\')');
    converted = converted.replace(/strftime\((['"])%Y\1,\s*([^ )]+)\)/gi, 'DATE_FORMAT(FROM_UNIXTIME($2), \'%Y\')');
    return converted;
};

const pool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
});

console.log(`Usando MySQL en ${MYSQL_HOST}:${MYSQL_PORT} DB=${MYSQL_DATABASE}`);

(async () => {
    try {
        await ensureDatabaseExists();

        await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(191) NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email VARCHAR(255),
            telefono VARCHAR(50),
            nombre VARCHAR(255),
            direccion TEXT,
            ciudad VARCHAR(255),
            pais VARCHAR(255),
            codigo_postal VARCHAR(32),
            detalles TEXT,
            foto_url VARCHAR(512)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS tokens_recuperacion (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expiracion BIGINT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS categorias (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            usuario_id INT NOT NULL,
            UNIQUE KEY unique_categoria_usuario (nombre, usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS productos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            descripcion TEXT,
            precio DOUBLE NOT NULL DEFAULT 0,
            costo DOUBLE DEFAULT 0,
            existencia INT NOT NULL DEFAULT 0,
            categoria_id INT,
            image_url VARCHAR(512),
            created_at BIGINT,
            updated_at BIGINT,
            usuario_id INT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS movimientos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tipo VARCHAR(50) NOT NULL,
            producto_id INT,
            cantidad INT NOT NULL DEFAULT 0,
            monto DOUBLE NOT NULL DEFAULT 0,
            descripcion TEXT,
            fecha BIGINT,
            cliente_id INT,
            proveedor_id INT,
            usuario_id INT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        // Función auxiliar que verifica si una columna ya existe en information_schema.
        const columnExists = async (table, column) => {
            const [rows] = await pool.query(
                'SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
                [MYSQL_DATABASE, table, column]
            );
            const total = rows && rows[0] ? Number(rows[0].total) : 0;
            return total > 0;
        };

        // Función auxiliar que agrega una columna si aún no está presente, ignorando errores de duplicado.
        const ensureColumn = async (table, column, definition) => {
            try {
                const exists = await columnExists(table, column);
                if (exists) return;
                await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
                console.log(`Columna ${column} añadida a ${table}`);
            } catch (err) {
                const msg = String(err && err.message ? err.message : err || '');
                if (err && err.code === 'ER_DUP_FIELDNAME') return;
                if (msg.includes('Duplicate column name')) return;
                console.error(`No se pudo añadir columna ${column} en ${table}:`, err);
            }
        };

        await ensureColumn('movimientos', 'cliente_id', 'INT NULL');
        await ensureColumn('movimientos', 'proveedor_id', 'INT NULL');
        await ensureColumn('movimientos', 'es_credito', 'TINYINT(1) NOT NULL DEFAULT 0');

        await pool.query(`CREATE TABLE IF NOT EXISTS clientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            direccion TEXT,
            telefono VARCHAR(50),
            email VARCHAR(255),
            usuario_id INT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS proveedores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            contacto VARCHAR(255),
            telefono VARCHAR(50),
            email VARCHAR(255),
            usuario_id INT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        console.log('Tablas MySQL verificadas/creadas');
    } catch (err) {
        console.error('Error creando tablas en MySQL:', err);
    }
})();

const db = {
    // Función estilo sqlite que ejecuta INSERT/UPDATE/DELETE y expone insertId/cambios vía callback opcional.
    run: async function(sql, params, cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        params = params || [];
        try {
            const normalizedSql = translateSql(sql);
            const [result] = await pool.execute(normalizedSql, params);
            const insertId = result && (result.insertId || null);
            const affectedRows = result && (result.affectedRows || 0);
            if (typeof cb === 'function') return cb.call({ lastID: insertId, changes: affectedRows }, null);
            return null;
        } catch (err) {
            if (typeof cb === 'function') return cb.call({}, err);
            throw err;
        }
    },
    // Función que devuelve una sola fila de resultado (o null) emulando sqlite get.
    get: async function(sql, params, cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        params = params || [];
        try {
            const normalizedSql = translateSql(sql);
            const [rows] = await pool.execute(normalizedSql, params);
            const row = (rows && rows.length) ? rows[0] : null;
            if (typeof cb === 'function') return cb(null, row);
            return row;
        } catch (err) {
            if (typeof cb === 'function') return cb(err);
            throw err;
        }
    },
    // Función que devuelve todas las filas del query, compatible con callbacks tipo sqlite all.
    all: async function(sql, params, cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        params = params || [];
        try {
            const normalizedSql = translateSql(sql);
            const [rows] = await pool.execute(normalizedSql, params);
            if (typeof cb === 'function') return cb(null, rows);
            return rows;
        } catch (err) {
            if (typeof cb === 'function') return cb(err);
            throw err;
        }
    },
    _pool: pool
};

module.exports = db;