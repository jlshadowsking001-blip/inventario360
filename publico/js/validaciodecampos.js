// Expresiones regulares para validar los campos
// Usuario: permitir 3-20 caracteres alfanuméricos o guion bajo (más flexible en desarrollo)
const usuarioRegex = /^[a-zA-Z0-9_]{3,20}$/;
// Contraseña: permitir cualquier caracter (excepto nueva línea) entre 4 y 100 chars
const contraseñaRegex = /^.{4,100}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const telefonoRegex = /^\d{8,12}$/;

/**
 * Validación visual en tiempo real
 * Muestra mensajes y cambia clases según el estado del campo
 */
function configurarValidacion(input, alerta, regex, mensaje) {
    input.addEventListener("focus", () => {
        alerta.style.display = "block";
        alerta.textContent = mensaje;
    });

    input.addEventListener("blur", () => {
        if(regex.test(input.value.trim())){
        alerta.style.display = "none";
        }
    });
    input.addEventListener("input", () => {
        const valor = input.value.trim();
        if (regex.test(valor)) {
            alerta.textContent="Campo Valido"       
            alerta.classList.add("valido");
            alerta.classList.remove("invalido");
            input.classList.add("input-valido");
            input.classList.remove("input-invalido");
        } else {
            alerta.textContent= mensaje;
            alerta.classList.add("invalido");
            alerta.classList.remove("valido");
            input.classList.add("input-invalido");
            input.classList.remove("input-valido");
        }
        alerta.style.display="block";
    });
}

/**
 * Validación funcional para submit
 * Devuelve true si el campo es válido, false si no
 */
function validarCampo(input, regex, alerta, mensaje) {
    const valor = input.value.trim();
    if (regex.test(valor)) {
        alerta.textContent = '';
        alerta.classList.remove('invalido');
        alerta.classList.add('valido');
        input.classList.remove('input-invalido');
        input.classList.add('input-valido');
        alerta.style.display = 'none';
        return true;
    } else {
        alerta.textContent = mensaje;
        alerta.classList.add('invalido');
        alerta.classList.remove('valido');
        input.classList.add('input-invalido');
        input.classList.remove('input-valido');
        alerta.style.display = 'block';
        return false;
    }
}

/**
 * Validación funcional para submit
 * Devuelve true si el campo es válido, false si no
 */
const mensaje = {
    usuario: "Usuario inválido (8-20 caracteres alfanuméricos o _)",
    contraseña: "Contraseña inválida (8-20 caracteres, admite símbolos !@#$...)",
    email: "Formato de correo no válido",
    telefono: "Teléfono inválido (8-12 dígitos)"
};

// Exportar a window para uso en scripts tradicionales
window.usuarioRegex = usuarioRegex;
window.contraseñaRegex = contraseñaRegex;
window.emailRegex = emailRegex;
window.telefonoRegex = telefonoRegex;
window.configurarValidacion = configurarValidacion;
window.validarCampo = validarCampo;
window.mensaje = mensaje;