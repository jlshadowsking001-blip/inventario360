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

window.cargarPerfil = async function cargarPerfil() {
    const currentUser = localStorage.getItem('usuarioActivo');
    if (!currentUser) return;
    try {
        const res = await fetch(`/usuarios/perfil/${encodeURIComponent(currentUser)}`);
        const data = await res.json();
        if (!res.ok) {
            console.warn('No se pudo cargar el perfil', data);
            return;
        }
        const perfil = data.usuario || {};
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };
        setValue('nombreUsuario', perfil.nombre);
        setValue('direccionUsuario', perfil.direccion);
        setValue('ciudadUsuario', perfil.ciudad);
        setValue('paisUsuario', perfil.pais);
        setValue('codigoPostalUsuario', perfil.codigo_postal);
        setValue('detallesUsuario', perfil.detalles);
        setValue('correoUsuario', perfil.email);
        setValue('telefonoUsuario', perfil.telefono);

        const preview = document.getElementById('previewFoto');
        if (preview && perfil.foto_url) preview.src = perfil.foto_url;

        const topbarNombre = document.getElementById('topbarNombre');
        const topbarFoto = document.getElementById('topbarFoto');
        if (topbarNombre) topbarNombre.textContent = perfil.nombre || perfil.username || currentUser;
        if (topbarFoto && perfil.foto_url) topbarFoto.src = perfil.foto_url;

        try { localStorage.setItem('perfilUsuario', JSON.stringify(perfil)); } catch (err) {}
    } catch (err) {
        console.error('Error cargando perfil:', err);
    }
};

