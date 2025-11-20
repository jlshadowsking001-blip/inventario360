const path = require('path');
const DB_TYPE = process.env.DB_TYPE || 'mysql';

if (DB_TYPE === 'mysql') {
    // MySQL (mysql2)
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (err) {
        console.error('El paquete "mysql2" no está instalado. Instálalo con: npm install mysql2');
        console.error('Si quieres usar SQLite en su lugar establece DB_TYPE=sqlite o instala mysql2.');
        process.exit(1);
    }
    const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
    const MYSQL_PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
    const MYSQL_USER = process.env.MYSQL_USER || 'root';
    const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
    const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'inventario360';

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

    /**
     * Traduce expresiones específicas de SQLite (strftime) a equivalentes MySQL.
     * Esto permite reutilizar las mismas consultas en ambos motores.
     */
    const translateSql = (query) => {
        if (typeof query !== 'string' || !query.includes('strftime')) return query;
        let converted = query;

        // timestamps actuales
        converted = converted.replace(/strftime\((['"])%s\1,\s*(['"])now\2\)/gi, 'UNIX_TIMESTAMP()');

        // Formatos de fecha para agrupaciones y reportes
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

    // Crear tablas simples si no existen (DDL compatible MySQL)
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
                nombre VARCHAR(255) NOT NULL
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
                updated_at BIGINT
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
                proveedor_id INT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

            const columnExists = async (table, column) => {
                const [rows] = await pool.query(
                    'SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
                    [MYSQL_DATABASE, table, column]
                );
                const total = rows && rows[0] ? Number(rows[0].total) : 0;
                return total > 0;
            };

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

            await pool.query(`CREATE TABLE IF NOT EXISTS clientes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                direccion TEXT,
                telefono VARCHAR(50),
                email VARCHAR(255)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

            await pool.query(`CREATE TABLE IF NOT EXISTS proveedores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                contacto VARCHAR(255),
                telefono VARCHAR(50),
                email VARCHAR(255)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

            console.log('Tablas MySQL verificadas/creadas');
        } catch (err) {
            console.error('Error creando tablas en MySQL:', err);
        }
    })();

    // Exponer API similar a sqlite3 (run/get/all)
    const db = {
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
        // expose pool for advanced queries if needed
        _pool: pool
    };

    module.exports = db;

} else {
    // SQLite (por defecto)
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'inventario360.db');
    const db = new sqlite3.Database(dbPath);
    console.log('Usando base de datos SQLite en:', dbPath);

    db.serialize(() => {
        // tabla de usuarios básica (columnas antiguas mantenidas)
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email TEXT,
            telefono TEXT
        )`, function(err){
            if(err) console.error('Error creando tabla de usuarios:',err.message);
            else console.log('Tabla usuarios verificada');
        });

        // tabla de tokens para recuperación
        db.run(`CREATE TABLE IF NOT EXISTS tokens_recuperacion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            token TEXT NOT NULL,
            expiracion INTEGER NOT NULL
        )`);

        // Categorías
        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL
        )`);

        // Productos
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio REAL NOT NULL DEFAULT 0,
            costo REAL DEFAULT 0,
            existencia INTEGER NOT NULL DEFAULT 0,
            categoria_id INTEGER,
            image_url TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER
        )`);

        // Movimientos: ventas, egresos, ajustes
        db.run(`CREATE TABLE IF NOT EXISTS movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            producto_id INTEGER,
            cantidad INTEGER NOT NULL DEFAULT 0,
            monto REAL NOT NULL DEFAULT 0,
            descripcion TEXT,
            fecha INTEGER DEFAULT (strftime('%s','now')),
            cliente_id INTEGER,
            proveedor_id INTEGER
        )`);

        const ensureColumnSqlite = (column) => {
            db.run(`ALTER TABLE movimientos ADD COLUMN ${column}`, (err) => {
                if (err && !String(err.message || '').includes('duplicate column name')) {
                    console.error(`No se pudo añadir columna ${column} en movimientos:`, err.message || err);
                }
            });
        };

        ensureColumnSqlite('cliente_id INTEGER');
        ensureColumnSqlite('proveedor_id INTEGER');

        // Clientes
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            direccion TEXT,
            telefono TEXT,
            email TEXT
        )`);

        // Proveedores
        db.run(`CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            telefono TEXT,
            email TEXT
        )`);
    });

    module.exports = db;
}