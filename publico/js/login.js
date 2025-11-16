console.log("login.js cargado");
// validaciodecampos.js expone las variables y funciones en window (usuarioRegex, contraseñaRegex, etc.)

// Mostrar/ocultar formularios (expuesto en window para los onclick del HTML)
function mostrarFormulario(formularioId){
    document.querySelectorAll('.formulario').forEach(f => f.classList.remove('activo'));
    const formulario = document.getElementById(formularioId);
    if (formulario) formulario.classList.add('activo');
}
window.mostrarFormulario = mostrarFormulario;

// Envío de datos para login
document.getElementById("formulario-inicio").addEventListener("submit", async function (e) {
    e.preventDefault();
    const usuarioInput = document.getElementById("login-username");
    const contraseñaInput = document.getElementById("login-contraseña");
    const alertaUsuario = document.getElementById("alerta-login-usuario");
    const alertaContraseña = document.getElementById("alerta-login-contraseña");
    const validoUsuario = validarCampo(usuarioInput, usuarioRegex, alertaUsuario, mensaje.usuario);
    const validoContraseña = validarCampo(contraseñaInput, contraseñaRegex, alertaContraseña,mensaje.contraseña);
    if (!validoUsuario || !validoContraseña) return;
    const username = usuarioInput.value.trim();
    const password = contraseñaInput.value.trim();
    console.log('Login: payload ->', { username, password });
    const res = await fetch("/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    console.log('Login: respuesta ->', res.status, data);
    if (res.ok) {
        localStorage.setItem("usuarioActivo", data.usuario.username);
        window.location.href = "inventario360.html";
    } else {
        alert(data.error);
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
    console.log('Registro: payload ->', { username, password, email, telefono });
    const res = await fetch("/usuarios/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email, telefono })
    });
    const data = await res.json();
    console.log('Registro: respuesta ->', res.status, data);
    if (res.ok) {
        alert("Registro exitoso. Ahora puedes iniciar sesión.");
        mostrarFormulario("formulario-inicio");
    } else {
        alert(data.error);
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