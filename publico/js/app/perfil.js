// ===============================
// Gestión del perfil de usuario
// ===============================

/**
 * Guarda los datos del perfil del usuario actual en el servidor.
 */
function guardarPerfil() {
    const currentUser = localStorage.getItem('usuarioActivo');
    if (!currentUser) return alert('No hay usuario activo');

    const payload = {
        nombre: document.getElementById("nombreUsuario").value,
        direccion: document.getElementById("direccionUsuario").value,
        ciudad: document.getElementById("ciudadUsuario").value,
        pais: document.getElementById("paisUsuario").value,
        codigo_postal: document.getElementById("codigoPostalUsuario").value,
        detalles: document.getElementById("detallesUsuario").value,
        email: document.getElementById("correoUsuario").value,
        telefono: document.getElementById("telefonoUsuario").value
    };

    fetch(`/usuarios/perfil/${encodeURIComponent(currentUser)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json().then(body => ({ status: r.status, body })))
    .then(({ status, body }) => {
        if (status >= 200 && status < 300) {
        alert('Perfil actualizado correctamente');
        try { localStorage.setItem('perfilUsuario', JSON.stringify(body.usuario)); } catch (err) {}
        } else {
        alert(body.error || 'Error actualizando perfil');
        }
    })
    .catch(err => {
        console.error('Error al enviar perfil:', err);
        alert('Error al comunicarse con el servidor');
    });
}

window.guardarPerfil = guardarPerfil;

