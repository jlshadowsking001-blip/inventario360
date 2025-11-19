// ===============================
// Inicialización global al cargar la app
// ===============================

window.addEventListener('load', () => {
    // Redirigir si no hay sesión activa
    if (!localStorage.getItem("usuarioActivo")) {
        window.location.href = "login.html";
        return;
    }

    // Cargar datos iniciales
    loadProducts();
    loadMovimientos();
    loadMovimientosUI();
    cargarCategorias();
    loadClientes();
    loadProveedores();

    // Cargar estadísticas con retraso para asegurar que Chart.js esté listo
    setTimeout(loadStats, 500);

    // Vincular buscador de inventario
    const buscador = document.getElementById('buscador');
    if (buscador) {
        buscador.addEventListener('input', debounce((e) => {
        searchProducts(e.target.value);
        }, 220));
    }

    // Vincular buscador de ventas
    const buscadorVentas = document.getElementById('buscadorVentas');
    if (buscadorVentas) {
        buscadorVentas.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = window._productosCache.filter(p =>
            (p.nombre || '').toLowerCase().includes(query) ||
            String(p.id).includes(query) ||
            (p.codigo || '').toLowerCase().includes(query)
        );
        searchProducts(query);
        renderSalesInventory(filtrados);
        }, 220));
    }

    // Mostrar foto y nombre en topbar si están en localStorage
    const fotoinput = document.getElementById('fotoperfil');
    const preview = document.getElementById('previewFoto');
    const topbarFoto = document.getElementById('topbarFoto');
    const topbarNombre = document.getElementById('topbarNombre');

    try {
        const fotoData = localStorage.getItem('perfilFoto');
        if (topbarFoto && fotoData) topbarFoto.src = fotoData;

        const storedUsuario = localStorage.getItem('perfilUsuario') || localStorage.getItem('usuarioActivo');
        if (topbarNombre && storedUsuario) {
        try {
            const parsed = JSON.parse(storedUsuario);
            topbarNombre.textContent = parsed.nombre || parsed.username || String(storedUsuario);
        } catch (e) {
            topbarNombre.textContent = storedUsuario;
        }
        }
    } catch (e) {}

    // Subir foto de perfil al servidor
    if (fotoinput) {
        fotoinput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (ev) {
            const dataUrl = ev.target.result;
            if (preview) preview.src = dataUrl;

            const currentUser = localStorage.getItem('usuarioActivo');
            if (!currentUser) return;

            try {
            const res = await fetch(`/usuarios/perfil/${encodeURIComponent(currentUser)}/foto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl })
            });

            const body = await res.json();
            if (res.ok && body.foto_url) {
                preview.src = body.foto_url;
                try { localStorage.setItem('perfilFoto', body.foto_url); } catch (err) {}
                alert('Foto subida correctamente');
            } else {
                alert(body.error || 'No se pudo subir la foto');
            }
            } catch (err) {
            console.error('Error subiendo foto:', err);
            alert('Error subiendo foto');
            }
        };
        reader.readAsDataURL(file);
        });
    }
});