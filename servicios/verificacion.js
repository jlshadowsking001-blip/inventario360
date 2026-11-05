const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 4;
const MAX_CODE_ATTEMPTS = 5;

function createError(message, status = 500) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function sendEmailCode(email, code, purpose) {
    const subject = purpose === 'registro' ? 'Verifica tu cuenta de Inventario 360' : 'Código para recuperar tu cuenta';
    const text = `Tu código de verificación es ${code}. Vence en 10 minutos. Si no solicitaste este código, ignora este mensaje.`;

    if (process.env.BREVO_API_KEY) {
        const senderEmail = process.env.BREVO_SENDER_EMAIL;
        if (!senderEmail) {
            throw createError('Falta configurar BREVO_SENDER_EMAIL con un remitente verificado en Brevo.');
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                accept: 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    email: senderEmail,
                    name: process.env.BREVO_SENDER_NAME || 'Inventario 360'
                },
                to: [{ email }],
                subject,
                textContent: text
            }),
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            console.error(`Brevo API rechazó el correo (HTTP ${response.status}).`);
            throw createError(`Brevo no aceptó el correo (HTTP ${response.status}). Revisa la clave API y el remitente verificado.`, 502);
        }
        return;
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
        throw createError('El envío de correo no está configurado en el servidor.');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: String(process.env.SMTP_SECURE || Number(SMTP_PORT) === 465) === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });
    await transporter.sendMail({
        from: process.env.SMTP_FROM || SMTP_USER,
        to: email,
        subject,
        text
    });
}

async function sendSmsCode(phone, code, purpose) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw createError('El envío de SMS no está configurado en el servidor.');
    }

    const body = new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Body: `Inventario 360: tu código para ${purpose === 'registro' ? 'verificar la cuenta' : 'recuperar la cuenta'} es ${code}. Vence en 10 minutos.`
    });
    const authorization = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });
    if (!response.ok) {
        const detail = await response.text();
        console.error('Twilio rechazó el envío de SMS:', response.status, detail);
        throw createError('No se pudo enviar el SMS. Verifica la configuración del proveedor.');
    }
}

async function issueCode(user, purpose, canal) {
    const destination = canal === 'email' ? user.email : user.telefono;
    if (!destination) throw createError('No hay un destino registrado para este canal.', 400);
    if (canal === 'sms' && !/^\+[1-9]\d{7,14}$/.test(destination)) {
        throw createError('El teléfono no está en formato internacional. Actualízalo después de verificar el correo.', 400);
    }

    const now = Date.now();
    const recent = await db.get(
        'SELECT COUNT(*) AS total FROM codigos_verificacion WHERE usuario_id = ? AND proposito = ? AND canal = ? AND creado >= ?',
        [user.id, purpose, canal, now - CODE_WINDOW_MS]
    );
    if (Number(recent && recent.total) >= MAX_CODES_PER_WINDOW) {
        throw createError('Se alcanzó el límite de códigos. Intenta de nuevo más tarde.', 429);
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = bcrypt.hashSync(code, 10);
    await db.run(
        'UPDATE codigos_verificacion SET consumido = 1 WHERE usuario_id = ? AND proposito = ? AND canal = ? AND consumido = 0',
        [user.id, purpose, canal]
    );
    await db.run(
        'INSERT INTO codigos_verificacion (usuario_id, proposito, canal, codigo_hash, expiracion, intentos, consumido, creado) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
        [user.id, purpose, canal, codeHash, now + CODE_TTL_MS, now]
    );

    try {
        if (canal === 'email') await sendEmailCode(destination, code, purpose);
        else await sendSmsCode(destination, code, purpose);
    } catch (error) {
        await db.run('DELETE FROM codigos_verificacion WHERE usuario_id = ? AND proposito = ? AND canal = ? AND codigo_hash = ?', [
            user.id, purpose, canal, codeHash
        ]);
        throw error;
    }
}

async function sendAccountCodes(user) {
    const pending = [];
    if (!Number(user.email_verificado)) pending.push('email');
    if (Number(user.telefono_requerido) && !Number(user.telefono_verificado)) pending.push('sms');

    const results = await Promise.allSettled(pending.map(canal =>
        issueCode(user, 'registro', canal === 'sms' ? 'sms' : canal)
    ));
    const sent = [];
    const failed = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') sent.push(pending[index]);
        else {
            failed.push(pending[index]);
            console.error(`No se pudo enviar código de verificación (${pending[index]}):`, result.reason.message);
        }
    });
    return { pending, sent, failed };
}

async function verifyCode(userId, purpose, canal, code) {
    const row = await db.get(
        'SELECT id, codigo_hash, expiracion, intentos FROM codigos_verificacion WHERE usuario_id = ? AND proposito = ? AND canal = ? AND consumido = 0 ORDER BY id DESC LIMIT 1',
        [userId, purpose, canal]
    );
    if (!row) throw createError('El código no es válido o ya fue utilizado.', 400);
    if (Date.now() > Number(row.expiracion)) {
        await db.run('UPDATE codigos_verificacion SET consumido = 1 WHERE id = ?', [row.id]);
        throw createError('El código venció. Solicita uno nuevo.', 400);
    }
    if (Number(row.intentos) >= MAX_CODE_ATTEMPTS) {
        await db.run('UPDATE codigos_verificacion SET consumido = 1 WHERE id = ?', [row.id]);
        throw createError('Se superó el número de intentos. Solicita un código nuevo.', 429);
    }

    const updated = await new Promise((resolve, reject) => {
        db.run(
            'UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id = ? AND consumido = 0 AND intentos < ?',
            [row.id, MAX_CODE_ATTEMPTS],
            function (error) {
                if (error) return reject(error);
                resolve(this.changes);
            }
        );
    });
    if (!updated) throw createError('El código ya fue utilizado. Solicita uno nuevo.', 400);
    if (!bcrypt.compareSync(String(code || ''), row.codigo_hash)) {
        throw createError('El código ingresado es incorrecto.', 400);
    }

    const consumed = await new Promise((resolve, reject) => {
        db.run(
            'UPDATE codigos_verificacion SET consumido = 1 WHERE id = ? AND consumido = 0',
            [row.id],
            function (error) {
                if (error) return reject(error);
                resolve(this.changes);
            }
        );
    });
    if (!consumed) throw createError('El código ya fue utilizado. Solicita uno nuevo.', 400);
    const verifiedColumn = canal === 'email' ? 'email_verificado' : 'telefono_verificado';
    await db.run(`UPDATE usuarios SET ${verifiedColumn} = 1 WHERE id = ?`, [userId]);
}

module.exports = { createError, issueCode, sendAccountCodes, verifyCode };
