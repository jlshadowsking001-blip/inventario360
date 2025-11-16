const db = require('./db');

db.all('SELECT id, username, email, telefono FROM usuarios', [], (err, rows) => {
    if (err) {
        console.error('Error leyendo usuarios desde read_users.js:', err);
        process.exit(1);
    }
    console.log('Usuarios en DB:', rows);
    process.exit(0);
});
