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

function requireBrevoApiKey() {
    if (!process.env.BREVO_API_KEY) {
        throw createError('Falta configurar BREVO_API_KEY para enviar códigos por SMS o WhatsApp.');
    }
}

async function sendSmsCode(phone, code, purpose) {
    requireBrevoApiKey();
    const sender = process.env.BREVO_SMS_SENDER;
    if (!sender || !(/^[a-z0-9]{1,11}$/i.test(sender) || /^\d{12,15}$/.test(sender))) {
        throw createError('Configura BREVO_SMS_SENDER con el remitente SMS aprobado (hasta 11 caracteres alfanuméricos o 15 dígitos).');
    }

    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify({
            recipient: phone,
            sender,
            type: 'transactional',
            content: `Inventario 360: tu codigo para ${purpose === 'registro' ? 'verificar la cuenta' : 'recuperar la cuenta'} es ${code}. Vence en 10 minutos.`
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        console.error(`Brevo rechazó el SMS (HTTP ${response.status}).`);
        throw createError(`Brevo no aceptó el SMS (HTTP ${response.status}). Revisa el remitente, el saldo y la cobertura del país.`, 502);
    }
}

async function sendWhatsappCode(phone, code) {
    requireBrevoApiKey();
    const senderNumber = process.env.BREVO_WHATSAPP_SENDER_NUMBER;
    const templateId = Number(process.env.BREVO_WHATSAPP_TEMPLATE_ID);
    const codeParam = process.env.BREVO_WHATSAPP_CODE_PARAM || 'CODE';
    if (!senderNumber || !/^\+?[1-9]\d{7,14}$/.test(senderNumber.replace(/\s+/g, ''))) {
        throw createError('Configura BREVO_WHATSAPP_SENDER_NUMBER con el número empresarial de WhatsApp, incluido el código de país.');
    }
    if (!Number.isSafeInteger(templateId) || templateId < 1) {
        throw createError('Configura BREVO_WHATSAPP_TEMPLATE_ID con el ID de una plantilla de verificación aprobada.');
    }
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(codeParam)) {
        throw createError('BREVO_WHATSAPP_CODE_PARAM debe ser el nombre válido de la variable del código en la plantilla.');
    }

    const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify({
            contactNumbers: [phone.replace(/\D/g, '')],
            senderNumber: senderNumber.replace(/\D/g, ''),
            templateId,
            params: { [codeParam]: code }
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        console.error(`Brevo rechazó el WhatsApp (HTTP ${response.status}).`);
        throw createError(`Brevo no aceptó el WhatsApp (HTTP ${response.status}). Revisa la cuenta, el número empresarial, la plantilla y el saldo.`, 502);
    }
}

async function issueCode(user, purpose, canal) {
    if (!['email', 'sms', 'whatsapp'].includes(canal)) {
        throw createError('Canal de verificación no válido.', 400);
    }
    const destination = canal === 'email' ? user.email : user.telefono;
    if (!destination) throw createError('No hay un destino registrado para este canal.', 400);
    if (canal !== 'email' && !/^\+[1-9]\d{7,14}$/.test(destination)) {
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
        else if (canal === 'sms') await sendSmsCode(destination, code, purpose);
        else await sendWhatsappCode(destination, code);
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
    if (Number(user.telefono_requerido) && !Number(user.telefono_verificado)) {
        pending.push(user.telefono_canal === 'whatsapp' ? 'whatsapp' : 'sms');
    }

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
