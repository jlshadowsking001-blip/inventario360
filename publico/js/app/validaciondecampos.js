// Adaptador para exponer las validaciones definidas en ../validaciodecampos.js
// Este archivo existe para que `index.js` pueda importar un módulo dentro de `app/`.

import '../validaciodecampos.js';

// No exporta nada: las variables y funciones de validación se exponen en `window`
export default {};
