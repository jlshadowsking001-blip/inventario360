const fs = require('fs');
const path = require('path');

const uploadDir = path.resolve(
    process.env.UPLOADS_DIR || path.join(__dirname, '..', 'publico', 'uploads')
);

fs.mkdirSync(uploadDir, { recursive: true });

module.exports = { uploadDir };
