console.log("login.js cargado");
// validaciodecampos.js expone las variables y funciones en window (usuarioRegex, contraseñaRegex, etc.)

// Mostrar/ocultar formularios (expuesto en window para los onclick del HTML)
function mostrarFormulario(formularioId){
    document.querySelectorAll('.formulario').forEach(f => f.classList.remove('activo'));
    const formulario = document.getElementById(formularioId);
    if (formulario) formulario.classList.add('activo');
}
window.mostrarFormulario = mostrarFormulario;

// Helper de depuración visible en la página (div #debugLogin)
function debugLog(msg) {
    try {
        const el = document.getElementById('debugLogin');
        if (!el) return console.log('[debug]', msg);
        el.style.display = 'block';
        const time = new Date().toLocaleTimeString();
        el.innerHTML = `<div>[${time}] ${String(msg)}</div>` + el.innerHTML;
    } catch (e) { console.log('[debug error]', e, msg); }
}
debugLog('login.js cargado');
// Envío de datos para login
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
        return alert('Error comunicándose con el servidor. Revisa la conexión y la consola.');
    }
    let data;
    try { data = await res.json(); } catch (err) { data = { error: 'Respuesta no JSON' }; }
    debugLog('Login: respuesta -> status=' + res.status + ' body=' + JSON.stringify(data));
    if (res.ok) {
        localStorage.setItem("usuarioActivo", data.usuario.username);
        debugLog('Inicio de sesión correcto. Redirigiendo...');
        window.location.href = "inventario360.html";
    } else {
        const msg = data && data.error ? data.error : ('Error HTTP ' + res.status);
        debugLog('Login fallido: ' + msg);
        alert(msg);
    }
});

// Envío de datos para registro
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
    // email y telefono son opcionales; validarlos solo si se ingresan
    const emailVal = emailInput.value.trim();
    const telefonoVal = telefonoInput.value.trim();
    let validoEmail = true;
    let validoTelefono = true;
    if (emailVal) validoEmail = validarCampo(emailInput, emailRegex, alertaEmail, "Email inválido");
    if (telefonoVal) validoTelefono = validarCampo(telefonoInput, telefonoRegex, alertaTelefono, "Teléfono inválido");
    if (!validoUsuario || !validoContraseña || !validoEmail || !validoTelefono) return;
    const username = usuarioInput.value.trim();
    const email = emailVal;
    const telefono = telefonoVal;
    const password = contraseñaInput.value.trim();
    debugLog('Registro: payload -> ' + JSON.stringify({ username, email, telefono }));
    let res;
    try {
        res = await fetch("/usuarios/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, email, telefono })
        });
    } catch (err) {
        debugLog('Error enviando registro: ' + (err && err.message ? err.message : String(err)) );
        return alert('No se pudo conectar al servidor');
    }
    let data;
    try { data = await res.json(); } catch(e){ data = { error: 'Respuesta no JSON' }; }
    debugLog('Registro: respuesta -> status=' + res.status + ' body=' + JSON.stringify(data));
    if (res.ok) {
        alert("Registro exitoso. Ahora puedes iniciar sesión.");
        mostrarFormulario("formulario-inicio");
    } else {
        alert(data.error || 'Error en registro');
    }
});

// Confirmar recuperación desde enlace con token
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
        mostrarFormulario("formulario-confirmar-recuperacion");
        document.getElementById("token-recuperacion").value = token;
    }
});

document.getElementById("formulario-confirmar-recuperacion").addEventListener("submit", async function (e) {
    e.preventDefault();
    const token = document.getElementById("token-recuperacion").value;
    const nuevaContraseñaInput = document.getElementById("nueva-contraseña");
    const alerta = document.getElementById("alerta-nueva-contraseña");
    const valido = validarCampo(nuevaContraseñaInput, contraseñaRegex, alerta, "Contraseña inválida");
    if (!valido) return;
    const nuevaContraseña = nuevaContraseñaInput.value.trim();
    const res = await fetch("/usuarios/confirmar-recuperacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nuevaContraseña })
    });
    const data = await res.json();
    if (res.ok) {
        alert("Contraseña actualizada. Ahora puedes iniciar sesión.");
        window.location.href = "login.html";
    } else {
        alert(data.error);
    }
});