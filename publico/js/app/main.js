// ===============================
// Inicialización global al cargar la app
// ===============================

/**
 * Punto de entrada del frontend (después de index.js).
 * Garantiza una única inicialización, chequea sesión y dispara las cargas base.
 */
async function initApp() {
    if (window.__APP_INITIALIZED) return;
    window.__APP_INITIALIZED = true;

    if (!localStorage.getItem('usuarioActivo')) {
        window.location.href = 'login.html';
        return;
    }

    try { window.cargarPerfil && window.cargarPerfil(); } catch (err) { console.warn('No se pudo cargar el perfil', err); }
    try { window.ensureMovimientosFiltros && window.ensureMovimientosFiltros(); } catch (err) { console.warn('No se pudieron inicializar filtros de movimientos', err); }
    try { window.ensureEstadisticasFiltros && window.ensureEstadisticasFiltros(); } catch (err) { console.warn('No se pudieron inicializar filtros de estadísticas', err); }

    const initialLoaders = [
        () => window.loadProducts && window.loadProducts(),
        () => window.loadMovimientos && window.loadMovimientos(),
        () => window.loadMovimientosUI && window.loadMovimientosUI(),
        () => window.cargarCategorias && window.cargarCategorias(),
        () => window.loadClientes && window.loadClientes(),
        () => window.loadProveedores && window.loadProveedores()
    ];
    initialLoaders.forEach(fn => {
        try { fn(); } catch (err) { console.warn('Error cargando datos iniciales', err); }
    });

    setTimeout(() => {
        try { window.loadStats && window.loadStats(); } catch (err) { console.warn('loadStats error', err); }
        try { window.filtrarEstadisticas && window.filtrarEstadisticas(); } catch (err) {}
    }, 500);

    const buscador = document.getElementById('buscador');
    if (buscador) {
        buscador.addEventListener('input', debounce((e) => {
            searchProducts(e.target.value);
        }, 220));
    }

    const buscadorVentas = document.getElementById('buscadorVentas');
    if (buscadorVentas) {
        buscadorVentas.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtrados = (window._productosCache || []).filter(p =>
                (p.nombre || '').toLowerCase().includes(query) ||
                String(p.id).includes(query) ||
                (p.codigo || '').toLowerCase().includes(query)
            );
            searchProducts(query);
            renderSalesInventory(filtrados);
        }, 220));
    }

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
                        if (preview) preview.src = body.foto_url;
                        try { localStorage.setItem('perfilFoto', body.foto_url); } catch (err) {}
                        alert('Foto subida correctamente');
                        window.cargarPerfil && window.cargarPerfil();
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}