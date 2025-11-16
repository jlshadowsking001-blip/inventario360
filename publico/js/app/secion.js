// ===============================
// Gestión de sesión de usuario
// ===============================

/**
 * Cierra la sesión del usuario actual y redirige al login.
 */
window.cerrarSesion = function cerrarSesion() {
    localStorage.removeItem("usuarioActivo");
    localStorage.removeItem("perfilUsuario");
    localStorage.removeItem("perfilFoto");
    window.location.href = "login.html";
};