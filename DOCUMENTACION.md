# Documentación funcional de Inventario360

Este resumen explica, en español, qué hace cada archivo principal, las funciones exportadas y la responsabilidad de cada bloque de código. Puedes usarlo como mapa rápido para localizar la lógica que necesites ajustar.

## 1. Frontend (carpeta `publico/`)

### 1.1 `publico/inventario360.html`
- Define la estructura completa de la SPA: sidebar con módulos, barra superior, secciones (`Perfil`, `inventario`, `ventas`, etc.), modales y scripts.
- Cada sección (`<section id="..." class="modulo">`) se muestra/oculta desde `navegacion.js`.

### 1.2 `publico/js/index.js`
- `async function bootstrap()`: importa los módulos ES que viven en `publico/js/app`, maneja errores y activa el módulo `inventario` inicial.
- Proporciona `window.setDevSkipAuth(enable)` para activar/desactivar el modo sin autenticación.
- Listeners globales `window.addEventListener('error')` y `unhandledrejection` registran fallos en la consola.

### 1.3 `publico/js/app/main.js`
- `initApp()`: entry point después de `bootstrap`. Verifica sesión (`localStorage.usuarioActivo`), inicializa filtros (`ensureMovimientosFiltros`, `ensureEstadisticasFiltros`), dispara cargas masivas (`loadProducts`, `loadMovimientos*`, `cargarCategorias`, `loadClientes`, `loadProveedores`).
- Configura buscadores (`#buscador`, `#buscadorVentas`) usando `debounce` para filtrar inventario y lista de ventas.
- Maneja la carga/subida de foto de perfil y sincroniza el nombre mostrado en la barra lateral.

### 1.4 `publico/js/app/navegacion.js`
- `window.mostrarModulo(nombreModulo)`: oculta todas las secciones `.modulo`, muestra la solicitada y actualiza `#topbarTitulo`. También dispara cargas específicas según el módulo (inventario, clientes, proveedores, etc.).
- `normalizeInlineOnclicks()`: convierte atributos `onclick` del HTML en listeners seguros.
- Helpers `window.crearProducto`, `crearCategorias`, `crearCliente`, `crearProveedor`, `verCategorias`: abren distintos modales con formularios prearmados.
- `MODAL_HANDLERS`: mapa que conecta los formularios del modal con funciones globales (`guardarProducto`, `guardarCategoria`, etc.).

### 1.5 `publico/js/app/modal.js`
- `window.abrirModal(titulo, html, options)`: configura `#modal`, inyecta el contenido HTML y guarda el handler a ejecutar al enviar.
- `window.cerrarModal()`: oculta el modal y limpia su formulario.
- Listeners adicionales permiten cerrar con `Escape` o clic en el fondo.

### 1.6 `publico/js/app/utils.js`
- `window.debounce(fn, delay)`: utilitario para retrasar llamadas.
- `window.formatearFecha(fecha)`, `window.formatearMoneda(valor)`: formateos comunes.
- `window.calcularGanancia(precio, costo)`: diferencia simple.

### 1.7 `publico/js/app/productos.js`
- Cache global `_productosCache` y resumen `actualizarResumenInventario()`.
- `guardarProducto()`: recoge campos (incluye imagen opcional en base64) y realiza `POST /productos`.
- `loadProducts()`: trae todos los productos, actualiza caches, tablas y paneles.
- `renderProductsTable(productos)`: genera la tabla editable del inventario y conecta inputs a `updateProduct`.
- `updateProduct(id, fields)`: `PATCH` parcial y refresca inventario/estadísticas.
- `editarProducto(id)`, `actualizarProductoModal()`, `eliminarProducto(id)`: flujo CRUD vía modal.
- `searchProducts(q)`: filtra la tabla y sincroniza la vista de ventas.

### 1.8 `publico/js/app/categorias.js`
- `window.categorias`: cache en memoria.
- `cargarCategorias()`: consulta `/categorias`, llena selects y encabezado de filtros.
- `guardarCategoria()`: crea categorías.
- `filtrarPorCategoria(id)` y `mostrarTodosProductos()`: conectan botones con la tabla principal.
- `renderizarCategoriasHeader()`: construye los chips del header.

### 1.9 `publico/js/app/ventas.js`
- Cache `_canasta` y funciones para pintar inventario (`renderSalesInventory`) y canasta (`renderCanasta`).
- Acciones rápidas: `addToCanasta`, `Nuevaventa`, `vaciarcanasta`.
- `terminarventa()`: recorre la canasta y registra cada producto como `POST /movimientos` tipo `venta`, refrescando inventario, movimientos y estadísticas.
- `abrirModalGasto()` / `guardarGasto()`: flujo para registrar movimientos tipo gasto vinculados a proveedores.

### 1.10 `publico/js/app/movimientos.js`
- `ensureMovimientosFiltros()`: setea fecha/rango por defecto.
- `loadMovimientos()` y `loadMovimientosUI({ applyDateFilter })`: consultas generales y filtradas.
- `renderMovimientosTable(movimientos)`: construye la tabla.
- `exportMovimientosCSV()`: genera un CSV con los movimientos cargados.
- `loadStats()`: endpoint `/movimientos/estadisticas/resumen`, arma los gráficos Chart.js y recalcula precios estimados de productos.
- `filtrarPorRango()`: helper del botón "Buscar".

### 1.11 `publico/js/app/estadisticas.js`
- `ensureEstadisticasFiltros()`: fecha/rango base.
- `filtrarEstadisticas()`: consulta `/estadisticas?rango=...`, llena la tabla detallada, totales rápidos y vuelve a dibujar ambos gráficos.

### 1.12 `publico/js/app/clientes.js`
- Cache `_clientesCache` y `loadClientes()` que consume `/clientes`, renderiza tabla y resumen.
- `renderClientesList(clientes)`: tabla con botones para editar/eliminar.
- `agregarCliente()`, `guardarCliente()`: flujos rápido y con modal.
- Funciones internas `editarCliente(cliente)`, `eliminarCliente(id)` y `refrescarSelectorClientes()`.

### 1.13 `publico/js/app/proveedores.js`
- Cache `_proveedoresCache`, `loadProveedores()` y `actualizarResumenProveedores()`.
- `renderProveedoresTable(items)`: tabla con celdas editables `contenteditable`.
- `agregarProveedor()` y `guardarProveedor()`.

### 1.14 `publico/js/app/perfil.js`
- `guardarPerfil()`: arma payload con los campos del formulario y hace `PUT /usuarios/perfil/:username`.
- `window.cargarPerfil()`: `GET /usuarios/perfil/:username`, rellena inputs, barra lateral y cache local.

### 1.15 `publico/js/app/ajustes.js`
- `window.guardarAjustes()`: guarda preferencia de empresa/moneda/notificaciones en `localStorage`.
- `window.exportarDatos()`: placeholder.
- `window.confirmarReset()`: limpia storage y recarga la app.

### 1.16 Otros módulos front
- `publico/js/app/secion.js`: `window.cerrarSesion()` limpia credenciales locales y lleva a `login.html`.
- `publico/js/app/modulo-ui.js`: versión ligera de `mostrarModulo` (mantiene compatibilidad con llamado inline).
- `publico/js/app/validaciondecampos.js`: importa `../validaciodecampos.js` para que las validaciones queden disponibles en el namespace `window`.
- `publico/js/login.js`: controla formularios de inicio/registro/recuperación, usa helpers `validarCampo`, almacena `usuarioActivo` y redirige tras login exitoso.
- `publico/js/validaciodecampos.js`: contiene las regex de usuario/contraseña/email/teléfono y expone `configurarValidacion` + `validarCampo`.

## 2. Backend (carpeta raíz)

### 2.1 `servidor.js`
- Configura Express, CORS (con lista blanca configurable) y middlewares de logging.
- Sirve la carpeta `publico`, inyecta rutas (`/usuarios`, `/productos`, `/movimientos`, `/categorias`, `/estadisticas`, `/clientes`, `/proveedores`).
- Maneja errores globales y arranca el servidor HTTP en `PORT` (y opcional `PORT2`).

### 2.2 `db.js`
- Abstrae el acceso a datos con dos modos:
  - **MySQL** (`DB_TYPE=mysql`): crea pool `mysql2`, garantiza que las tablas existan, traduce expresiones `strftime` a `DATE_FORMAT` y expone una API estilo sqlite (`run`, `get`, `all`).
  - **SQLite** (por defecto): crea el archivo `inventario360.db`, inicializa tablas básicas y añade columnas faltantes.
- Esta capa se requiere en todas las rutas para mantener compatibilidad.

### 2.3 `controles/usuariocontole.js`
- `exports.iniciarSesion(req,res)`: busca usuario por `username`, compara hashes con `bcrypt.compareSync` y responde con datos básicos.
- `exports.registrarUsuario(req,res)`: hashea contraseña, inserta el registro y devuelve el usuario recién creado (sin password).

### 2.4 Middlewares (`middlewares/*.js`)
- `validacionlogin.js`: exige `username` y `password` (mínimo 8 caracteres) antes de permitir `POST /usuarios/login`.
- `validacionregistro.js`: valida `username`, `password`, normaliza `telefono` (8-12 dígitos) y chequea email cuando existe.
- `valdacionususarios.js`: versión genérica usada para endpoints que comparten validaciones; aplica reglas adicionales cuando la ruta incluye `registro`.

### 2.5 Rutas REST (`routes/*.js`)
- `routes/usuarios.js`: monta endpoints de registro/login (delegados al controlador), recuperación con tokens (`solicitar-recuperacion`, `confirmar-recuperacion`), debug (`/debug/list`, `/debug/test-write`) y el CRUD del perfil (incluida la subida de foto usando dataURL -> archivo en `publico/uploads`).
- `routes/categorias.js`: CRUD básico para categorías (GET/POST/PUT/DELETE) usando la tabla `categorias`.
- `routes/productos.js`: CRUD completo con soporte para guardar imágenes base64 en `/uploads` y actualizar campos parcial o completamente.
- `routes/movimientos.js`: registra movimientos según tipo (`venta`, `egreso`, `gasto`, `ajuste`), actualiza stock cuando aplica, lista movimientos con filtros y expone `/movimientos/estadisticas/resumen` para alimentar Chart.js.
- `routes/estadisticas.js`: recibe `rango` + `fechaBase`, agrupa las ventas por periodo y producto, entrega totales (`total_unidades`, `total_monto`, `total_costo`).
- `routes/clientes.js`: CRUD de clientes + resumen (`totalClientes`, `totalPorCobrar`) calculado desde la tabla de movimientos.
- `routes/proveedores.js`: CRUD de proveedores + resumen (`totalProveedores`, `totalPorPagar`) con base en movimientos tipo gasto/egreso.

## 3. Hojas de estilo (`publico/stilos/appstyles.css`)
- El archivo ahora está dividido por secciones con comentarios en español. Cada bloque declara el módulo al que afecta (Inventario, Ventas, Estadísticas, Perfil, etc.), los componentes reutilizables (tablas, modales) y los ajustes responsivos. Consulta los encabezados `/* === Sección X: ... === */` para ubicar rápidamente dónde editar.

## 4. Flujo general
1. El usuario ingresa por `login.html`, que valida campos con `validaciodecampos.js` y consume `/usuarios/login`.
2. Tras guardar `usuarioActivo` en `localStorage`, `inventario360.html` carga `publico/js/index.js`, que importa los módulos y deja todo en `window` para compatibilidad.
3. `main.js` inicializa datos, `navegacion.js` controla la SPA, `modal.js` maneja cualquier formulario emergente y los módulos (`productos`, `ventas`, `clientes`, etc.) consumen las rutas Express.
4. El backend Express gestiona autenticación, CRUDs y cálculos agregados; `db.js` se encarga de que las mismas consultas funcionen sobre MySQL o SQLite.

Con esta guía puedes identificar rápidamente qué archivo modificar según la funcionalidad (frontend o backend) y comprender el flujo de datos completo.
