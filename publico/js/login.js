console.log("login.js cargado");
// Eliminar el div de depuración si por alguna razón permanece en el DOM (cache viejo).
const debugNode = document.getElementById('debugLogin');
if (debugNode) debugNode.remove();

// validaciodecampos.js expone las variables y funciones en window (usuarioRegex, contraseñaRegex, etc.)

// Mostrar/ocultar formularios (expuesto en window para los onclick del HTML)
// Función que alterna la visibilidad de los formularios y asegura que sólo uno quede activo.
function mostrarFormulario(formularioId){
    document.querySelectorAll('.formulario').forEach(f => f.classList.remove('activo'));
    const formulario = document.getElementById(formularioId);
    if (formulario) formulario.classList.add('activo');
}
window.mostrarFormulario = mostrarFormulario;
let credencialesPendientes = null;
let recuperacionPendiente = null;

async function enviarJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));
    return { response, data };
}

// Helper de depuración visible en la página (div #debugLogin)
// Función que escribe mensajes de depuración en el panel o la consola con marca de tiempo.
function debugLog(msg) {
    try {
        const time = new Date().toLocaleTimeString();
        console.log(`[debug ${time}]`, msg);
    } catch (e) { console.log('[debug error]', e, msg); }
}
// Ya no se muestra en pantalla, solo consola:
debugLog('login.js cargado');
// Envío de datos para login
// Maneja el submit del formulario de inicio: valida campos y envía la petición al backend.
document.getElementById("formulario-inicio").addEventListener("submit", async function (e) {
    e.preventDefault();
    const usuarioInput = document.getElementById("login-username");
    const contraseñaInput = document.getElementById("login-contraseña");
    const alertaUsuario = document.getElementById("alerta-login-usuario");
    const alertaContraseña = document.getElementById("alerta-login-contraseña");
    const validoUsuario = validarCampo(usuarioInput, usuarioRegex, alertaUsuario, mensaje.usuario);
    const validoContraseña = validarCampo(contraseñaInput, contraseñaRegex, alertaContraseña, mensaje.contraseña);
    if (!validoUsuario || !validoContraseña) {
        debugLog('Validación falló. Usuario o contraseña no cumplen el formato. Se intentará enviar de todas formas para diagnóstico.');
        // continuamos para diagnosticar en el servidor y mostrar respuesta
    }
    const username = usuarioInput.value.trim();
    const password = contraseñaInput.value.trim();
    debugLog('Login: payload -> ' + JSON.stringify({ username: String(username).replace(/./g,'*') }) );
    // Enviar petición al backend
    let res;
    try {
        res = await fetch("/usuarios/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
    } catch (err) {
        debugLog('Error enviando petición: ' + (err && err.message ? err.message : String(err)));
        return window.showToast('Error comunicándose con el servidor. Revisa la conexión y la consola.', 'error');
    }
    let data;
    try { data = await res.json(); } catch (err) { data = { error: 'Respuesta no JSON' }; }
    debugLog('Login: respuesta -> status=' + res.status + ' body=' + JSON.stringify(data));
    if (res.ok) {
        // Guardar nombre de usuario para compatibilidad con el resto de la app
        localStorage.setItem("usuarioActivo", data.usuario.username);
        // Guardar ID para peticiones que necesitan aislamiento por usuario
        localStorage.setItem("usuarioActivoId", String(data.usuario.id));
        // Guardar perfil completo para mostrar datos como nombre y email
        localStorage.setItem("perfilUsuario", JSON.stringify(data.usuario));

        debugLog('Inicio de sesión correcto. Redirigiendo...');
        window.location.href = "inventario360.html";
    } else if (res.status === 403 && data.verificacionRequerida) {
        credencialesPendientes = { username, password };
        document.getElementById("estado-verificacion").textContent = data.errorEnvio || "Verifica el código enviado a tu correo.";
        mostrarFormulario("formulario-verificar-cuenta");
    } else {
        const msg = data && data.error ? data.error : ('Error HTTP ' + res.status);
        debugLog('Login fallido: ' + msg);
        window.showToast(msg, 'error');
    }
});

// Envío de datos para registro
// Maneja el formulario de registro: valida entradas opcionales y crea al usuario vía API.
document.getElementById("formulario-registro").addEventListener("submit", async function (e) {
    e.preventDefault();
    const usuarioInput = document.getElementById("registro-username");
    const emailInput = document.getElementById("registro-email");
    const telefonoInput = document.getElementById("registro-telefono");
    const contraseñaInput = document.getElementById("registro-contraseña");
    const alertaUsuario = document.getElementById("alerta-registro-usuario");
    const alertaEmail = document.getElementById("alerta-registro-email");
    const alertaTelefono = document.getElementById("alerta-telefono");
    const alertaContraseña = document.getElementById("alerta-registro-contraseña");
    const validoUsuario = validarCampo(usuarioInput, usuarioRegex, alertaUsuario, "Usuario inválido");
    const validoContraseña = validarCampo(contraseñaInput, contraseñaRegex, alertaContraseña, "Contraseña inválida");
    const emailVal = emailInput.value.trim();
    const telefonoVal = telefonoInput.value.trim();
    const validoEmail = validarCampo(emailInput, emailRegex, alertaEmail, "Email inválido");
    const validoTelefono = !telefonoVal || validarCampo(telefonoInput, telefonoRegex, alertaTelefono, mensaje.telefono);
    if (!telefonoVal) {
        alertaTelefono.textContent = "";
        alertaTelefono.classList.remove("invalido", "valido");
        telefonoInput.classList.remove("input-invalido", "input-valido");
        alertaTelefono.style.display = "none";
    }
    if (!validoUsuario || !validoContraseña || !validoEmail || !validoTelefono) return;
    const username = usuarioInput.value.trim();
    const email = emailVal;
    const telefono = telefonoVal || null;
    const password = contraseñaInput.value.trim();
    credencialesPendientes = { username, password };
    let res;
    try {
        res = await fetch("/usuarios/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, email, telefono })
        });
    } catch (err) {
        debugLog('Error enviando registro: ' + (err && err.message ? err.message : String(err)) );
        return window.showToast('No se pudo conectar al servidor', 'error');
    }
    let data;
    try { data = await res.json(); } catch(e){ data = { error: 'Respuesta no JSON' }; }
    debugLog('Registro: respuesta -> status=' + res.status + ' body=' + JSON.stringify(data));
    if (res.ok) {
        document.getElementById("estado-verificacion").textContent = data.errorEnvio || data.mensaje;
        mostrarFormulario("formulario-verificar-cuenta");
    } else {
        credencialesPendientes = null;
        window.showToast(data.error || 'Error en registro', 'error');
    }
});

document.getElementById("formulario-verificar-cuenta").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!credencialesPendientes) return window.showToast("Inicia sesión nuevamente para solicitar los códigos.", 'error');
    const codigo = document.getElementById("codigo-verificacion").value.trim();
    try {
        const { response, data } = await enviarJson("/usuarios/verificar-cuenta", {
            username: credencialesPendientes.username,
            canal: "email",
            codigo
        });
        if (!response.ok) return window.showToast(data.error || "No se pudo verificar el código", 'error');
        if (data.verificada) {
            credencialesPendientes = null;
            window.showToast("Correo verificado. Ahora puedes iniciar sesión.", 'success');
            mostrarFormulario("formulario-inicio");
            return;
        }
        document.getElementById("codigo-verificacion").value = "";
        document.getElementById("estado-verificacion").textContent = data.mensaje;
    } catch (error) {
        console.error("Error verificando cuenta:", error);
        window.showToast("No se pudo conectar al servidor para verificar la cuenta.", 'error');
    }
});

document.getElementById("reenviar-codigo").addEventListener("click", async () => {
    if (!credencialesPendientes) return window.showToast("Inicia sesión nuevamente para solicitar los códigos.", 'error');
    try {
        const { response, data } = await enviarJson("/usuarios/reenviar-verificacion", credencialesPendientes);
        if (!response.ok) return window.showToast(data.error || "No se pudieron reenviar los códigos", 'error');
        document.getElementById("estado-verificacion").textContent = data.errorEnvio || "Se envió nuevamente el código al correo.";
    } catch (error) {
        console.error("Error reenviando códigos:", error);
        window.showToast("No se pudo conectar al servidor para reenviar los códigos.", 'error');
    }
});

document.getElementById("formulario-recuperar").addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("recuperacion-usuario").value.trim();
    const canal = "email";
    try {
        const { response, data } = await enviarJson("/usuarios/solicitar-recuperacion", { username, canal });
        if (!response.ok) return window.showToast(data.error || "No se pudo solicitar el código", 'error');
        recuperacionPendiente = { username, canal };
        window.showToast(data.mensaje, 'success');
        mostrarFormulario("formulario-confirmar-recuperacion");
    } catch (error) {
        console.error("Error solicitando recuperación:", error);
        window.showToast("No se pudo conectar al servidor para solicitar el código.", 'error');
    }
});

document.getElementById("formulario-confirmar-recuperacion").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!recuperacionPendiente) return window.showToast("Solicita primero un código de recuperación.", 'error');
    const codigo = document.getElementById("codigo-recuperacion").value.trim();
    const nuevaContraseñaInput = document.getElementById("nueva-contraseña");
    const alerta = document.getElementById("alerta-nueva-contraseña");
    const valido = validarCampo(nuevaContraseñaInput, contraseñaRegex, alerta, "Contraseña inválida");
    if (!valido) return;
    const nuevaContraseña = nuevaContraseñaInput.value.trim();
    try {
        const { response, data } = await enviarJson("/usuarios/confirmar-recuperacion", {
            ...recuperacionPendiente,
            codigo,
            nuevaContraseña
        });
        if (response.ok) {
            recuperacionPendiente = null;
            window.showToast("Contraseña actualizada. Ahora puedes iniciar sesión.", 'success');
            mostrarFormulario("formulario-inicio");
        } else {
            window.showToast(data.error || "No se pudo actualizar la contraseña.", 'error');
        }
    } catch (error) {
        console.error("Error confirmando recuperación:", error);
        window.showToast("No se pudo conectar al servidor para actualizar la contraseña.", 'error');
    }
});