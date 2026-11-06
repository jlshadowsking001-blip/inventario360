# Documentación funcional y de estilos de Inventario360

Este documento resume la responsabilidad de cada archivo principal (frontend, backend y CSS) y detalla cómo están organizados los estilos. Úsalo como mapa rápido antes de tocar código.

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
- `guardarProducto()`: recoge campos (incluye imagen opcional en base64) y realiza `POST /productos`; las imágenes se guardan como BLOB en MySQL.
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
- `ensureMovimientosFiltros()`: fija fecha base y rango activo al cargar el módulo.
- `loadMovimientos()` / `loadMovimientosUI({ applyDateFilter })`: consumen `/movimientos`, enviando `fechaBase` + `rango` (día, semana, mes, año). El backend devuelve ya filtrado el tramo solicitado.
- `renderMovimientosTable(movimientos)`: agrupa los movimientos por periodo, imprime la fila resumen (ingresos, egresos, neto) y, debajo, los renglones detallados. Soporta fechas almacenadas como epoch (segundos o milisegundos) y cadenas ISO.
- `cambiarRangoMovimientos()` / `seleccionarRangoMovimientos(rango)`: sincronizan el chip "Vista ..." y la etiqueta bajo el título para dejar claro en qué escala se ve la tabla.
- `exportMovimientosCSV()`: descarga lo que esté en memoria.
- `loadStats()`: sigue entregando datos para el dashboard rápido.
- `filtrarPorRango()`: botón que re-dispara `loadMovimientosUI` con los filtros actuales.

### 1.11 `publico/js/app/estadisticas.js`
- `ensureEstadisticasFiltros()`: prepara los inputs.
- `filtrarEstadisticas()`: llama al backend, pinta tabla, totales y gráficos. Se añadió `formatPeriodoLabel()` para mostrar etiquetas legibles (ej. `18/11` o `Sem 47 2025`).

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
- `publico/js/login.js`: controla formularios de inicio/registro/recuperación; la verificación de cuenta y recuperación usan el correo electrónico, mientras el teléfono es opcional y solo de contacto.
- `publico/js/validaciodecampos.js`: contiene las regex de usuario/contraseña/email/teléfono y expone `configurarValidacion` + `validarCampo`.

## 2. Backend (carpeta raíz)

### 2.1 `servidor.js`
- Configura Express, CORS (con lista blanca configurable) y middlewares de logging.
- Sirve la carpeta `publico`, inyecta rutas (`/usuarios`, `/productos`, `/movimientos`, `/categorias`, `/estadisticas`, `/clientes`, `/proveedores`).
- Maneja errores globales y arranca el servidor HTTP en `PORT` (y opcional `PORT2`).

### 2.2 `db.js`
- Abstrae el acceso a datos con dos modos:
  - **MySQL** (`DB_TYPE=mysql`): crea pool `mysql2`, garantiza que las tablas existan, migra los BLOB y MIME de imágenes de productos/perfiles, traduce expresiones `strftime` a `DATE_FORMAT` y expone una API estilo sqlite (`run`, `get`, `all`).
  - **SQLite** (por defecto): crea el archivo `inventario360.db`, inicializa tablas básicas y añade columnas faltantes.
- Esta capa se requiere en todas las rutas para mantener compatibilidad.

### 2.3 `controles/usuariocontole.js`
- `exports.iniciarSesion(req,res)`: busca usuario por `username`, compara hashes con `bcrypt.compareSync` y responde con datos básicos.
- `exports.registrarUsuario(req,res)`: hashea contraseña, inserta el registro y devuelve el usuario recién creado (sin password).

### 2.4 Middlewares (`middlewares/*.js`)
- `validacionlogin.js`: exige `username` y `password` (mínimo 8 caracteres) antes de permitir `POST /usuarios/login`.
- `validacionregistro.js`: valida `username`, `password` y correo, y valida el teléfono internacional solo si se proporciona.
- `valdacionususarios.js`: versión genérica usada para endpoints que comparten validaciones; aplica reglas adicionales cuando la ruta incluye `registro`.

### 2.5 Rutas REST (`routes/*.js`)
- `routes/usuarios.js`: monta endpoints de registro/login (delegados al controlador), verificación y recuperación por correo, debug (`/debug/list`, `/debug/test-write`) y el CRUD del perfil. Las nuevas fotos se guardan en MySQL y se sirven desde `/perfil/:username/foto`; se conservan las URLs antiguas de `/uploads`.
- `routes/categorias.js`: CRUD básico para categorías (GET/POST/PUT/DELETE) usando la tabla `categorias`.
- `routes/productos.js`: CRUD completo con soporte para guardar imágenes base64 de hasta 6 MB como BLOB en MySQL, servirlas por usuario sin incluir los bytes en listados y actualizar campos parcial o completamente. Las URLs antiguas de `/uploads` siguen siendo compatibles.
- `routes/movimientos.js`: además del CRUD de movimientos, ahora acepta `fechaBase` + `rango` para devolver sólo el tramo solicitado. El helper interno alinea la fecha al inicio del periodo (día, semana ISO, mes o año) y convierte cualquier formato de fecha almacenado en segundos/milisegundos.
- `routes/estadisticas.js`: recibe `rango` + `fechaBase`, agrupa las ventas por periodo y producto, entrega totales (`total_unidades`, `total_monto`, `total_costo`).
- `routes/clientes.js`: CRUD de clientes + resumen (`totalClientes`, `totalPorCobrar`) calculado desde la tabla de movimientos.
- `routes/proveedores.js`: CRUD de proveedores + resumen (`totalProveedores`, `totalPorPagar`) con base en movimientos tipo gasto/egreso.

## 3. Estilos CSS

Aunque la SPA carga varias hojas, la mayoría de componentes terminan en `publico/stilos/appstyles.css`, organizada por secciones. Guía rápida:

1. **Globals/Layout** (`stilos/globals.css` y `stilos/layout.css`)
  - Variables CSS (`--color-primary`, `--font-heading`, etc.), reset y grillas base.
  - `layout.css` define el `aside.sidebar`, `main.contenido`, media queries para colapsar la barra lateral y la clase `modulo--full` que permite que una sección ocupe todo el ancho/alto del viewport.

2. **Inventario (`stilos/inventario.css`)**
  - Hero superior (`inventario-hero`), buscadores, resumen y tabla con encabezado pegajoso. Las clases `inventario-tabla-wrapper` y `.inventario-tabla-scroll` controlan el scroll independiente sin mover el encabezado.

3. **Ventas (`stilos/ventas.css`)**
  - Define los paneles a dos columnas (`ventas-panel--catalogo` / `--cart`), los chips de categoría, toggles de pago (`ventas-pago-btn`) y la canasta en tarjetas.

4. **Movimientos (Sección 10 en `appstyles.css`)
  - `movimientos-card` aplica el gradiente morado, bordes redondeados y sticky header.
  - `mov-pill-chip-group`, `mov-chip`, `mov-pill` controlan los botones tipo pastilla (filtros rápidos, pestañas Ingresos/Egresos).
  - `mov-vista-actual` muestra el rango seleccionado, mientras `mov-periodo-row` y `mov-periodo-resumen` pintan las filas agrupadas y sus totales.
  - La tabla usa `.movimientos-tabla-scroll` para permitir scroll interno con header fijo (`position: sticky`).

5. **Modales / componentes reutilizables**
  - Bloque "Componentes reutilizables" define estilos genéricos de tablas (`.tabla-wrapper`), cabeceras fijas con `position: sticky`, y la ventana modal (`.modal`, `.modal-content`).

6. **Estadísticas (Sección 11 en `appstyles.css`)
  - `stats-card` es un contenedor flex vertical. Secciones internas (`.stats-heading-block`, `.stats-content-block`) reparten el espacio: la cabecera ocupa ~10 % y la zona de visualización aprovecha el resto.
  - `metric-card`, `stats-filter-card` y `stats-charts-row` controlan cards, filtros y responsive grid de gráficas.
  
  - `.stats-table .tabla-wrapper` mantiene alturas máximas y scroll sin perder el estilo del mockup.

7. **Perfil y otros bloques**
  - Secciones posteriores (Perfil, Ajustes, Clientes, etc.) siguen el patrón: tarjeta clara, bordes redondeados y tipografía `var(--font-heading)` para títulos.

> **Consejo:** cada bloque en `appstyles.css` abre con un comentario `/* === Sección X: ... === */`. Busca ahí para modificar estilos de un módulo sin perderte.

## 4. Flujo general
1. El usuario ingresa por `login.html`, que valida campos con `validaciodecampos.js` y consume `/usuarios/login`.
2. Tras guardar `usuarioActivo` en `localStorage`, `inventario360.html` carga `publico/js/index.js`, que importa los módulos y deja todo en `window` para compatibilidad.
3. `main.js` inicializa datos, `navegacion.js` controla la SPA, `modal.js` maneja cualquier formulario emergente y los módulos (`productos`, `ventas`, `clientes`, etc.) consumen las rutas Express.
4. El backend Express gestiona autenticación, CRUDs y cálculos agregados; `db.js` se encarga de que las mismas consultas funcionen sobre MySQL o SQLite.

Con esta guía puedes identificar rápidamente qué archivo modificar según la funcionalidad (frontend o backend) y comprender el flujo de datos completo.