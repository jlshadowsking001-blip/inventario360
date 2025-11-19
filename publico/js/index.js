// ===============================
// INVENTARIO360 - Punto de entrada
// ===============================
// Este archivo importa todos los módulos y arranca la aplicación
// siguiendo la estructura de inventario360.html

// --- Importar módulos principales ---
// Cargado de módulos de forma dinámica y con manejo de errores
async function bootstrap() {
  try {
      // Modal y navegación deben inicializarse antes que el resto de módulos
      await import('./app/modal.js');
      await import('./app/navegacion.js');

    // Importar el resto en paralelo y capturar errores
    const modules = [
      './app/productos.js',
      './app/categorias.js',
      './app/ventas.js',
      './app/movimientos.js',
      './app/estadisticas.js',
      './app/clientes.js',
      './app/proveedores.js',
      './app/perfil.js',
      './app/ajustes.js',
      './app/utils.js',
      './app/validaciondecampos.js',
      './app/main.js'
    ];

    await Promise.all(modules.map(m => import(m).catch(err => {
      console.error('Error importando módulo', m, err);
      return null;
    })));

    // Comprobar sesión simple: si no hay usuario activo, redirigir al login
    // Permitir modo desarrollo para saltar auth mediante:
    // - localStorage.setItem('DEV_SKIP_AUTH','1')
    // - añadiendo ?noauth=1 a la URL
    // - o asignando window.__DEV_SKIP_AUTH = true en la consola
    try {
      const urlParams = new URLSearchParams(window.location.search || '');
      const skipQuery = urlParams.get('noauth') === '1';
      const skipLocal = window.localStorage && window.localStorage.getItem('DEV_SKIP_AUTH') === '1';
      const skipGlobal = Boolean(window.__DEV_SKIP_AUTH);
      const skipAuth = skipQuery || skipLocal || skipGlobal;

      /*if (skipAuth) {
        console.warn('DEV_SKIP_AUTH active: saltando comprobación de sesión (desactivar con localStorage.removeItem("DEV_SKIP_AUTH") o ?noauth=0)');
      } else {
        const usuarioActivo = window.localStorage ? window.localStorage.getItem('usuarioActivo') : null;
        if (!usuarioActivo) {
          // si la ruta login está disponible en el servidor redirigimos allí
          const loginUrl = '/login';
          console.log('No hay usuario activo, redirigiendo a', loginUrl);
          window.location.href = loginUrl;
          return;
        }
      }*/
    } catch (e) {
      console.warn('Error comprobando usuarioActivo en localStorage', e);
    }

    // Helper para activar/desactivar desde la consola
    window.setDevSkipAuth = function(enable) {
      try {
        if (enable) {
          window.localStorage.setItem('DEV_SKIP_AUTH', '1');
          console.log('DEV_SKIP_AUTH habilitado');
        } else {
          window.localStorage.removeItem('DEV_SKIP_AUTH');
          console.log('DEV_SKIP_AUTH deshabilitado');
        }
      } catch (e) { console.warn('No se pudo cambiar DEV_SKIP_AUTH', e); }
    };

    // Mostrar inventario por defecto al cargar
    if (typeof window.mostrarModulo === 'function') {
      window.mostrarModulo('inventario');
    }

    // Debug: listar funciones clave para verificar cargado
    console.log('App init - funciones visibles:', {
      mostrarModulo: typeof window.mostrarModulo,
      crearProducto: typeof window.crearProducto,
      crearCategorias: typeof window.crearCategorias,
      crearCliente: typeof window.crearCliente,
      crearProveedor: typeof window.crearProveedor,
      guardarProducto: typeof window.guardarProducto
    });

  } catch (err) {
    console.error('Error en bootstrap de la app:', err);
  }
}

// Manejo global de errores para facilitar debug en consola
window.addEventListener('error', (e) => {
  console.error('Unhandled error event:', e.error || e.message, e.filename || '');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

document.addEventListener('DOMContentLoaded', bootstrap);