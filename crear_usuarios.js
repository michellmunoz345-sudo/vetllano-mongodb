// =====================================================================
// crear_usuarios.js - VetLlano
// Crea el usuario administrador y el usuario de aplicacion.
// Las contrasenas se piden por consola con passwordPrompt():
// NO se escriben en el codigo ni quedan en el historial.
//
// Ejecutar ANTES de activar la autenticacion (con authorization desactivado):
//   mongosh crear_usuarios.js
// =====================================================================

const NOMBRE_ADMIN = "admin_mongo";
const NOMBRE_APP = "app_vetllano";
const BASE_PROYECTO = "vetllano";

// ---------------------------------------------------------------------
// 1. Usuario administrador (base "admin", rol root)
//    Solo para administrar el servidor, respaldos y usuarios.
//    La aplicacion NUNCA debe usar este usuario.
// ---------------------------------------------------------------------
const bdAdmin = db.getSiblingDB("admin");
if (bdAdmin.getUser(NOMBRE_ADMIN)) {
  print("El administrador '" + NOMBRE_ADMIN + "' ya existe, no se modifica.");
} else {
  bdAdmin.createUser({
    user: NOMBRE_ADMIN,
    pwd: passwordPrompt(),                       // se pide por consola
    roles: [{ role: "root", db: "admin" }]
  });
  print("Administrador '" + NOMBRE_ADMIN + "' creado.");
}

// ---------------------------------------------------------------------
// 2. Usuario de aplicacion (base "vetllano", rol readWrite SOLO sobre vetllano)
//    Minimo privilegio: puede leer y escribir en la base del proyecto,
//    pero no administrar usuarios ni tocar otras bases.
// ---------------------------------------------------------------------
const bdProyecto = db.getSiblingDB(BASE_PROYECTO);
if (bdProyecto.getUser(NOMBRE_APP)) {
  print("El usuario de aplicacion '" + NOMBRE_APP + "' ya existe, no se modifica.");
} else {
  bdProyecto.createUser({
    user: NOMBRE_APP,
    pwd: passwordPrompt(),                       // se pide por consola
    roles: [{ role: "readWrite", db: BASE_PROYECTO }]
  });
  print("Usuario de aplicacion '" + NOMBRE_APP + "' creado con readWrite sobre '" + BASE_PROYECTO + "'.");
}

// ---------------------------------------------------------------------
// 3. Verificacion (sin mostrar contrasenas)
// ---------------------------------------------------------------------
print("\nUsuarios creados:");
printjson(bdAdmin.getUser(NOMBRE_ADMIN, { showPrivileges: false }).roles);
printjson(bdProyecto.getUser(NOMBRE_APP, { showPrivileges: false }).roles);
