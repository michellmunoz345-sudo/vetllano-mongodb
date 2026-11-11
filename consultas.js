// =====================================================================
// consultas.js - VetLlano (Proyecto #7: Registro de mascotas y servicios veterinarios)
// 10 consultas, 4 actualizaciones, 3 agregaciones y 3 indices con explain().
// Cada bloque lleva la pregunta de negocio que responde.
//
// Requisito: haber ejecutado antes  mongosh datos_iniciales.js
// Ejecucion:  mongosh consultas.js
//   (con autenticacion:  mongosh -u <usuario_app> --authenticationDatabase vetllano consultas.js)
//
// Nota: las actualizaciones (seccion 2) modifican datos. Para volver al
// estado original basta con volver a ejecutar datos_iniciales.js.
// =====================================================================

const bd = db.getSiblingDB("vetllano");

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
// Fecha de referencia fija para que los resultados sean reproducibles.
// En una aplicacion real se usaria:  const hoy = new Date();
const hoy = new Date("2026-11-10T00:00:00Z");
const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000); // hoy + 30 dias
const sumarMeses = (d, m) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + m); return r; };

// Imprime titulo, pregunta de negocio y resultado (cursor o arreglo)
const mostrar = (titulo, pregunta, datos) => {
  print("\n--- " + titulo);
  print("Pregunta de negocio: " + pregunta);
  printjson(datos.toArray ? datos.toArray() : datos);
};

// Mascota de referencia (se busca por subdocumento microchip) para varias consultas
const toby = bd.mascotas.findOne({ "microchip.numero": "941000012345678" });

print("=====================================================");
print(" 1. CONSULTAS (find)");
print("=====================================================");

// ---------------------------------------------------------------------
// C1. Historial clinico de una mascota (consulta clave #1)
// Operadores: referencia (mascota_id), proyeccion, ordenamiento, limit
// ---------------------------------------------------------------------
// Pregunta: ¿Cuales son las ultimas consultas de Toby, con diagnostico y tratamiento?
mostrar("C1. Historial clinico de Toby",
  "¿Cuales son las ultimas consultas de Toby, con su diagnostico y tratamiento?",
  bd.consultas.find(
    { mascota_id: toby._id },
    { _id: 0, fecha: 1, motivo: 1, "diagnosticos.descripcion": 1, tratamientos: 1 }  // proyeccion
  ).sort({ fecha: -1 }).limit(5));                                                  // mas recientes primero

// ---------------------------------------------------------------------
// C2. Vacunas proximas a vencer (consulta clave #2)
// Operadores de comparacion: $gte y $lte sobre fechas
// ---------------------------------------------------------------------
// Pregunta: ¿A que propietarios hay que llamar porque el refuerzo vence en los proximos 30 dias?
mostrar("C2. Vacunas que vencen en los proximos 30 dias",
  "¿Que refuerzos de vacunas vencen en los proximos 30 dias para llamar al propietario?",
  bd.vacunas.find(
    { proxima_dosis: { $gte: hoy, $lte: en30 } },
    { _id: 0, mascota_id: 1, nombre_vacuna: 1, proxima_dosis: 1, clinica: 1 }
  ).sort({ proxima_dosis: 1 }));

// ---------------------------------------------------------------------
// C3. Vacunas criticas atrasadas
// Operadores logicos: $or combinado con comparacion $lt (AND implicito)
// ---------------------------------------------------------------------
// Pregunta: ¿Que mascotas tienen vencida la vacuna de rabia o parvovirus (riesgo sanitario)?
mostrar("C3. Rabia o parvovirus vencidas",
  "¿Que mascotas tienen atrasada la vacuna de rabia o de parvovirus (riesgo sanitario)?",
  bd.vacunas.find({
    proxima_dosis: { $lt: hoy },
    $or: [{ nombre_vacuna: "Rabia" }, { nombre_vacuna: "Parvovirus canino" }]
  }, { _id: 0, mascota_id: 1, nombre_vacuna: 1, proxima_dosis: 1 }));

// ---------------------------------------------------------------------
// C4. Mascotas de un propietario buscado por celular (consulta clave #3)
// Busqueda en arreglo de subdocumentos con $elemMatch
// ---------------------------------------------------------------------
// Pregunta: ¿Quien es el dueño de este celular y cuales son sus mascotas?
const propCel = bd.propietarios.findOne({
  telefonos: { $elemMatch: { tipo: "celular", numero: "310 245 8890" } }
});
mostrar("C4. Mascotas del propietario con celular 310 245 8890",
  "Al llamar un cliente, ¿quien es y cuales son sus mascotas?",
  bd.mascotas.find({ propietario_id: propCel._id }, { _id: 0, nombre: 1, especie: 1, raza: 1 }));

// ---------------------------------------------------------------------
// C5. Mascotas con alergia a antibioticos (consulta clave #4)
// Busqueda en arreglo con $in
// ---------------------------------------------------------------------
// Pregunta: ¿Que pacientes NO se pueden tratar con penicilina o sulfas?
mostrar("C5. Alergia a penicilina o sulfas",
  "¿Que pacientes son alergicos a penicilina o sulfas y requieren otro antibiotico?",
  bd.mascotas.find(
    { alergias: { $in: ["penicilina", "sulfas"] } },
    { _id: 0, nombre: 1, especie: 1, alergias: 1 }
  ));

// ---------------------------------------------------------------------
// C6. Pacientes de cuidado: con alergias o condiciones cronicas
// Operadores logicos: $and + $or, ordenamiento por dos campos
// ---------------------------------------------------------------------
// Pregunta: ¿Que mascotas activas necesitan seguimiento especial (alergias o enfermedad cronica)?
mostrar("C6. Pacientes de seguimiento especial",
  "¿Que mascotas activas tienen alergias o condiciones cronicas y requieren seguimiento?",
  bd.mascotas.find({
    $and: [
      { activa: true },
      { $or: [
        { "alergias.0": { $exists: true } },              // arreglo con al menos un elemento
        { "condiciones_cronicas.0": { $exists: true } }
      ] }
    ]
  }, { _id: 0, nombre: 1, especie: 1, alergias: 1, condiciones_cronicas: 1 })
    .sort({ especie: 1, nombre: 1 }));

// ---------------------------------------------------------------------
// C7. Consultas con diagnostico grave
// Busqueda en arreglo de subdocumentos ($elemMatch) + ordenamiento descendente
// ---------------------------------------------------------------------
// Pregunta: ¿Que casos graves se atendieron y cuales fueron los mas costosos?
mostrar("C7. Casos graves por costo",
  "¿Que casos graves se atendieron y cuales fueron los mas costosos?",
  bd.consultas.find(
    { diagnosticos: { $elemMatch: { gravedad: "grave" } } },
    { _id: 0, fecha: 1, motivo: 1, "diagnosticos.descripcion": 1, costo_cop: 1 }
  ).sort({ costo_cop: -1 }));

// ---------------------------------------------------------------------
// C8. Consultas con fiebre
// Consulta sobre subdocumento (notacion de punto) con $gt
// ---------------------------------------------------------------------
// Pregunta: ¿Que pacientes llegaron con temperatura mayor a 39.5 °C?
// (las aves tienen temperatura normal mas alta; se revisan aparte)
mostrar("C8. Pacientes con fiebre",
  "¿Que pacientes llegaron con temperatura superior a 39.5 °C?",
  bd.consultas.find(
    { "signos_vitales.temperatura_c": { $gt: 39.5 } },
    { _id: 0, fecha: 1, motivo: 1, "signos_vitales.temperatura_c": 1 }
  ).sort({ "signos_vitales.temperatura_c": -1 }));

// ---------------------------------------------------------------------
// C9. Tratamientos largos con un medicamento
// $elemMatch con dos condiciones sobre el mismo subdocumento del arreglo
// ---------------------------------------------------------------------
// Pregunta: ¿Que pacientes recibieron doxiciclina por 10 dias o mas (control de resistencia)?
mostrar("C9. Doxiciclina por 10 dias o mas",
  "¿Que pacientes recibieron doxiciclina por 10 dias o mas (control de uso de antibioticos)?",
  bd.consultas.find(
    { tratamientos: { $elemMatch: { medicamento: "Doxiciclina", duracion_dias: { $gte: 10 } } } },
    { _id: 0, fecha: 1, motivo: 1, tratamientos: 1 }
  ));

// ---------------------------------------------------------------------
// C10. Perros grandes sin esterilizar
// Operadores: igualdad, $gt, orden descendente
// ---------------------------------------------------------------------
// Pregunta: ¿Que perros de mas de 20 kg no estan esterilizados (campaña de esterilizacion)?
mostrar("C10. Perros grandes sin esterilizar",
  "¿Que perros de mas de 20 kg no estan esterilizados para la campaña de esterilizacion?",
  bd.mascotas.find(
    { especie: "perro", esterilizado: false, peso_kg: { $gt: 20 } },
    { _id: 0, nombre: 1, raza: 1, peso_kg: 1 }
  ).sort({ peso_kg: -1 }));

print("\n=====================================================");
print(" 2. ACTUALIZACIONES");
print("=====================================================");

// ---------------------------------------------------------------------
// U1. $set - registrar cirugia de esterilizacion
// ---------------------------------------------------------------------
// Pregunta: Rocky fue esterilizado hoy; ¿como dejamos su ficha actualizada con el nuevo peso?
print("\n--- U1. $set: esterilizacion de Rocky");
print("Antes: ");
printjson(bd.mascotas.findOne({ nombre: "Rocky" }, { _id: 0, nombre: 1, esterilizado: 1, peso_kg: 1 }));
printjson(bd.mascotas.updateOne({ nombre: "Rocky" }, { $set: { esterilizado: true, peso_kg: 28.4 } }));
print("Despues: ");
printjson(bd.mascotas.findOne({ nombre: "Rocky" }, { _id: 0, nombre: 1, esterilizado: 1, peso_kg: 1 }));

// ---------------------------------------------------------------------
// U2. $inc - aplicar refuerzo de rabia
// ---------------------------------------------------------------------
// Pregunta: Toby recibio hoy el refuerzo de rabia; ¿como sumamos la dosis y programamos la proxima?
print("\n--- U2. $inc: refuerzo de rabia de Toby");
const filtroRabia = { mascota_id: toby._id, nombre_vacuna: "Rabia" };
print("Antes: ");
printjson(bd.vacunas.findOne(filtroRabia, { _id: 0, dosis_numero: 1, fecha_aplicacion: 1, proxima_dosis: 1 }));
printjson(bd.vacunas.updateOne(filtroRabia, {
  $inc: { dosis_numero: 1 },                                    // suma una dosis al carnet
  $set: { fecha_aplicacion: hoy, proxima_dosis: sumarMeses(hoy, 12), "lote.numero": "RB2611-A" }
}));
print("Despues: ");
printjson(bd.vacunas.findOne(filtroRabia, { _id: 0, dosis_numero: 1, fecha_aplicacion: 1, proxima_dosis: 1 }));

// ---------------------------------------------------------------------
// U3. $push y $pull - alergias de la mascota (arreglo embebido)
// ---------------------------------------------------------------------
// Pregunta: Max presento reaccion al ibuprofeno y se descarto la alergia al pollo de Luna;
//           ¿como actualizamos sus listas de alergias sin reescribir el documento?
print("\n--- U3. $push / $pull: alergias");
printjson(bd.mascotas.updateOne({ nombre: "Max" }, { $push: { alergias: "ibuprofeno" } }));    // agrega al arreglo
printjson(bd.mascotas.updateOne({ nombre: "Luna" }, { $pull: { alergias: "pollo" } }));        // quita del arreglo
printjson(bd.mascotas.find({ nombre: { $in: ["Max", "Luna"] } }, { _id: 0, nombre: 1, alergias: 1 }).toArray());

// ---------------------------------------------------------------------
// U4. Upsert - registrar propietario nuevo o actualizar si ya existe
// ---------------------------------------------------------------------
// Pregunta: En recepcion llega un cliente; si su cedula ya existe actualizamos sus datos
//           y si no, ¿lo creamos sin duplicarlo?
print("\n--- U4. Upsert de propietario por cedula");
const upsertPropietario = () => bd.propietarios.updateOne(
  { cedula: "1121456789" },                                      // criterio de busqueda
  {
    $set: {
      nombres: "Brayan Stiven", apellidos: "Acosta Ruiz", correo: "brayan.acosta@example.com",
      telefonos: [{ tipo: "celular", numero: "319 407 2265" }],
      direccion: { barrio: "San Benito", calle: "Calle 23 # 45-10", ciudad: "Villavicencio", departamento: "Meta" }
    },
    $setOnInsert: { fecha_registro: hoy, activo: true }          // solo se escribe al crear
  },
  { upsert: true }
);
print("Primera ejecucion (crea el documento): ");
printjson(upsertPropietario());   // upsertedCount: 1
print("Segunda ejecucion (ya existe, no duplica): ");
printjson(upsertPropietario());   // matchedCount: 1, upsertedCount: 0

print("\n=====================================================");
print(" 3. AGREGACIONES");
print("=====================================================");

// ---------------------------------------------------------------------
// A1. $lookup doble + $group - ingresos por barrio del propietario
// ---------------------------------------------------------------------
// Pregunta: ¿De que barrios vienen los clientes que mas ingresos generan a la clinica?
mostrar("A1. Ingresos por barrio del propietario",
  "¿De que barrios vienen los clientes que mas ingresos generan (para decidir donde hacer publicidad)?",
  bd.consultas.aggregate([
    { $lookup: { from: "mascotas", localField: "mascota_id", foreignField: "_id", as: "mascota" } },
    { $unwind: "$mascota" },
    { $lookup: { from: "propietarios", localField: "mascota.propietario_id", foreignField: "_id", as: "propietario" } },
    { $unwind: "$propietario" },
    { $group: {
        _id: "$propietario.direccion.barrio",
        consultas: { $sum: 1 },
        ingresos_cop: { $sum: "$costo_cop" },
        ticket_promedio: { $avg: "$costo_cop" }
    } },
    { $project: { _id: 0, barrio: "$_id", consultas: 1, ingresos_cop: 1, ticket_promedio: { $round: ["$ticket_promedio", 0] } } },
    { $sort: { ingresos_cop: -1 } }
  ]));

// ---------------------------------------------------------------------
// A2. $unwind + $group - casos por gravedad (consulta clave #5)
// ---------------------------------------------------------------------
// Pregunta: ¿Como se distribuyen los diagnosticos por gravedad, cuanto cuestan en promedio
//           y que enfermedades incluye cada nivel?
mostrar("A2. Diagnosticos por gravedad",
  "¿Como se distribuyen los diagnosticos por gravedad, cuanto cuesta atenderlos y cuales son?",
  bd.consultas.aggregate([
    { $unwind: "$diagnosticos" },                                   // un documento por diagnostico
    { $group: {
        _id: "$diagnosticos.gravedad",
        casos: { $sum: 1 },
        costo_promedio_cop: { $avg: "$costo_cop" },
        diagnosticos: { $addToSet: "$diagnosticos.descripcion" }
    } },
    { $project: { _id: 0, gravedad: "$_id", casos: 1, costo_promedio_cop: { $round: ["$costo_promedio_cop", 0] }, diagnosticos: 1 } },
    { $sort: { casos: -1 } }
  ]));

// ---------------------------------------------------------------------
// A3. $lookup + $project con $cond - lista de recordatorios de vacunacion
// ---------------------------------------------------------------------
// Pregunta: ¿A quien debe llamar hoy la recepcion (nombre y celular) por vacunas vencidas
//           o que vencen en los proximos 30 dias?
mostrar("A3. Recordatorios de vacunacion",
  "¿A quien debe llamar la recepcion por vacunas vencidas o que vencen en los proximos 30 dias?",
  bd.vacunas.aggregate([
    { $match: { proxima_dosis: { $lte: en30 } } },
    { $lookup: { from: "mascotas", localField: "mascota_id", foreignField: "_id", as: "mascota" } },
    { $unwind: "$mascota" },
    { $lookup: { from: "propietarios", localField: "mascota.propietario_id", foreignField: "_id", as: "propietario" } },
    { $unwind: "$propietario" },
    { $project: {
        _id: 0,
        mascota: "$mascota.nombre",
        vacuna: "$nombre_vacuna",
        proxima_dosis: 1,
        estado: { $cond: [{ $lt: ["$proxima_dosis", hoy] }, "VENCIDA", "PROXIMA (30 dias)"] },
        propietario: { $concat: ["$propietario.nombres", " ", "$propietario.apellidos"] },
        celular: { $arrayElemAt: ["$propietario.telefonos.numero", 0] }
    } },
    { $sort: { proxima_dosis: 1 } }
  ]));

print("\n=====================================================");
print(" 4. INDICES Y RENDIMIENTO (explain executionStats)");
print("=====================================================");

// Resume el resultado de explain: etapas del plan y metricas clave
const etapas = (plan) => {
  const r = [];
  (function rec(x) {
    if (!x) return;
    r.push(x.stage + (x.indexName ? "(" + x.indexName + ")" : ""));
    if (x.inputStage) rec(x.inputStage);
    if (x.inputStages) x.inputStages.forEach(rec);
  })(plan.queryPlan || plan);
  return r.join(" -> ");
};
const explicar = (etiqueta, cursor) => {
  const e = cursor.explain("executionStats");
  const s = e.executionStats;
  print("  [" + etiqueta + "]");
  print("    Plan ganador         : " + etapas(e.queryPlanner.winningPlan));
  print("    Documentos devueltos : " + s.nReturned);
  print("    Documentos examinados: " + s.totalDocsExamined);
  print("    Claves examinadas    : " + s.totalKeysExamined);
  print("    Tiempo (ms)          : " + s.executionTimeMillis);
};

// Se eliminan los indices de prueba para poder re-ejecutar el script
const quitarIndice = (col, nombre) => { try { bd[col].dropIndex(nombre); } catch (e) { /* no existia */ } };
quitarIndice("propietarios", "cedula_unica");
quitarIndice("consultas", "mascota_fecha");
quitarIndice("vacunas", "proxima_dosis");

// ---------------------------------------------------------------------
// I1. Indice UNICO sobre propietarios.cedula
// ---------------------------------------------------------------------
// Pregunta: ¿Como encontramos un cliente por cedula al instante y evitamos registrarlo dos veces?
print("\n--- I1. Indice unico: propietarios.cedula");
const consultaI1 = () => bd.propietarios.find({ cedula: "40321456" });
explicar("ANTES (sin indice)", consultaI1());
bd.propietarios.createIndex({ cedula: 1 }, { unique: true, name: "cedula_unica" });
explicar("DESPUES (con indice unico)", consultaI1());
// Prueba de unicidad: documento valido pero con cedula repetida
try {
  bd.propietarios.insertOne({
    cedula: "40321456", nombres: "Duplicado", apellidos: "De Prueba",
    telefonos: [{ tipo: "celular", numero: "300 000 0000" }],
    direccion: { barrio: "Centro", calle: "Calle 1 # 1-1", ciudad: "Villavicencio", departamento: "Meta" },
    fecha_registro: hoy, activo: true
  });
  print("  ERROR: se acepto una cedula duplicada");
} catch (e) {
  print("  OK - cedula duplicada rechazada: " + e.message.split("\n")[0] + " (codigo " + e.code + ")");
}
print("  Interpretacion: sin indice MongoDB hace COLLSCAN y examina TODOS los propietarios;");
print("  con indice hace IXSCAN y examina 1 documento. Ademas el indice unico impide cedulas repetidas.");

// ---------------------------------------------------------------------
// I2. Indice COMPUESTO sobre consultas {mascota_id, fecha}
// ---------------------------------------------------------------------
// Pregunta: ¿Como mostramos el historial clinico de una mascota ya ordenado por fecha, sin ordenar en memoria?
print("\n--- I2. Indice compuesto: consultas {mascota_id: 1, fecha: -1}");
const consultaI2 = () => bd.consultas.find({ mascota_id: toby._id }).sort({ fecha: -1 });
explicar("ANTES (sin indice)", consultaI2());
bd.consultas.createIndex({ mascota_id: 1, fecha: -1 }, { name: "mascota_fecha" });
explicar("DESPUES (con indice compuesto)", consultaI2());
print("  Interpretacion: antes se recorria toda la coleccion y se hacia una etapa SORT en memoria;");
print("  despues el indice ya guarda las consultas de cada mascota ordenadas por fecha: se examinan");
print("  solo las consultas de esa mascota y desaparece la etapa SORT.");

// ---------------------------------------------------------------------
// I3. Indice simple sobre vacunas.proxima_dosis (consultas por rango de fechas)
// ---------------------------------------------------------------------
// Pregunta: ¿Como encontramos rapido las vacunas que vencen en los proximos 30 dias?
print("\n--- I3. Indice simple: vacunas.proxima_dosis");
const consultaI3 = () => bd.vacunas.find({ proxima_dosis: { $gte: hoy, $lte: en30 } });
explicar("ANTES (sin indice)", consultaI3());
bd.vacunas.createIndex({ proxima_dosis: 1 }, { name: "proxima_dosis" });
explicar("DESPUES (con indice)", consultaI3());
print("  Interpretacion: el rango de fechas pasa de revisar todas las vacunas (COLLSCAN) a leer solo");
print("  el tramo del indice que cae en esos 30 dias (IXSCAN). Con 20 documentos la diferencia en ms");
print("  es minima; la metrica que importa es 'documentos examinados', que con miles de vacunas");
print("  seria la diferencia entre revisar todo el historial y revisar solo los recordatorios del mes.");

print("\n=== consultas.js finalizado ===");
