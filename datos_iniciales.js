// =====================================================================
// datos_iniciales.js - VetLlano (Proyecto #7: Registro de mascotas y servicios veterinarios)
// Crea la base "vetllano", sus 4 colecciones con validacion $jsonSchema
// e inserta datos realistas de Villavicencio y el Meta.
//
// Ejecucion:   mongosh datos_iniciales.js
//   (con autenticacion activa:  mongosh -u <admin> --authenticationDatabase admin datos_iniciales.js)
//   o desde mongosh:  load("datos_iniciales.js")
//
// El script es re-ejecutable: borra las colecciones y las vuelve a crear.
// =====================================================================

const bd = db.getSiblingDB("vetllano");

// ---------------------------------------------------------------------
// 0. Utilidades
// ---------------------------------------------------------------------
// ObjectId predecibles para poder referenciar entre colecciones.
//   propietarios: 0001-000f | mascotas: 0101-0112 | consultas: 0201-0213 | vacunas: 0301-0314
const oid = (n) => ObjectId("665f1a2b3c4d5e6f7a8b" + n.toString(16).padStart(4, "0"));
const idProp = (n) => oid(n);          // n = 1..15
const idMasc = (n) => oid(0x100 + n);  // n = 1..18
const fecha = (s) => new Date(s);
// Suma meses a una fecha (para el vencimiento del lote de cada vacuna)
const sumarMeses = (d, m) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + m); return r; };

// Veterinarios (se embeben como subdocumento dentro de cada consulta)
const vets = [
  { nombre: "Andres Felipe Morales",  tarjeta_profesional: "MV-10458", clinica: "Clinica Veterinaria Llanos Pets" },
  { nombre: "Natalia Quintero Ospina", tarjeta_profesional: "MV-11230", clinica: "Veterinaria Patitas del Ariari" },
  { nombre: "Camilo Ernesto Duarte",  tarjeta_profesional: "MV-09876", clinica: "Centro Veterinario Orinoquia" },
  { nombre: "Laura Vanessa Cifuentes", tarjeta_profesional: "MV-12044", clinica: "Veterinaria San Benito Pets" }
];

// ---------------------------------------------------------------------
// 1. Crear colecciones con validacion $jsonSchema
// ---------------------------------------------------------------------
["propietarios", "mascotas", "consultas", "vacunas"].forEach((c) => bd[c].drop());

// 1.1 propietarios: direccion (subdocumento) y telefonos (arreglo de subdocumentos) embebidos
bd.createCollection("propietarios", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["cedula", "nombres", "apellidos", "telefonos", "direccion", "fecha_registro", "activo"],
    properties: {
      cedula:    { bsonType: "string", pattern: "^[0-9]{6,10}$", description: "Cedula solo con digitos" },
      nombres:   { bsonType: "string", minLength: 2 },
      apellidos: { bsonType: "string", minLength: 2 },
      correo:    { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
      telefonos: {
        bsonType: "array", minItems: 1,
        items: {
          bsonType: "object", required: ["tipo", "numero"],
          properties: {
            tipo:   { enum: ["celular", "fijo"] },
            numero: { bsonType: "string", pattern: "^(3[0-9]{2}|60[0-9]) [0-9]{3} [0-9]{4}$", description: "Formato colombiano: 3XX XXX XXXX o 60X XXX XXXX" }
          }
        }
      },
      direccion: {
        bsonType: "object", required: ["barrio", "calle", "ciudad", "departamento"],
        properties: {
          barrio: { bsonType: "string" }, calle: { bsonType: "string" },
          ciudad: { bsonType: "string" }, departamento: { bsonType: "string" }
        }
      },
      fecha_registro: { bsonType: "date" },
      activo:         { bsonType: "bool" }
    }
  } },
  validationLevel: "strict", validationAction: "error"
});

// 1.2 mascotas: referencia a propietario; microchip, alergias y condiciones embebidos
bd.createCollection("mascotas", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["propietario_id", "nombre", "especie", "sexo", "fecha_nacimiento", "peso_kg", "esterilizado", "activa"],
    properties: {
      propietario_id:   { bsonType: "objectId" },
      nombre:           { bsonType: "string", minLength: 1 },
      especie:          { enum: ["perro", "gato", "conejo", "ave", "otro"] },
      raza:             { bsonType: "string" },
      sexo:             { enum: ["macho", "hembra"] },
      fecha_nacimiento: { bsonType: "date" },
      peso_kg:          { bsonType: "number", minimum: 0.05, maximum: 120, description: "Peso entre 50 g y 120 kg" },
      esterilizado:     { bsonType: "bool" },
      microchip: {
        bsonType: "object", required: ["numero"],
        properties: { numero: { bsonType: "string", pattern: "^[0-9]{15}$" }, fecha_implante: { bsonType: "date" } }
      },
      alergias:             { bsonType: "array", items: { bsonType: "string" } },
      condiciones_cronicas: { bsonType: "array", items: { bsonType: "string" } },
      ultima_consulta: {
        bsonType: "object", required: ["fecha", "motivo"],
        properties: { fecha: { bsonType: "date" }, motivo: { bsonType: "string" } }
      },
      activa: { bsonType: "bool" }
    }
  } },
  validationLevel: "strict", validationAction: "error"
});

// 1.3 consultas: referencia a mascota; veterinario, signos vitales, diagnosticos y tratamientos embebidos
bd.createCollection("consultas", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["mascota_id", "fecha", "motivo", "veterinario", "signos_vitales", "diagnosticos", "costo_cop"],
    properties: {
      mascota_id: { bsonType: "objectId" },
      fecha:      { bsonType: "date" },
      motivo:     { bsonType: "string", minLength: 3 },
      veterinario: {
        bsonType: "object", required: ["nombre", "tarjeta_profesional", "clinica"],
        properties: { nombre: { bsonType: "string" }, tarjeta_profesional: { bsonType: "string" }, clinica: { bsonType: "string" } }
      },
      signos_vitales: {
        bsonType: "object", required: ["temperatura_c", "frecuencia_cardiaca", "peso_kg"],
        properties: {
          temperatura_c:       { bsonType: "number", minimum: 30, maximum: 45 },
          frecuencia_cardiaca: { bsonType: "number", minimum: 20, maximum: 400 },
          peso_kg:             { bsonType: "number", minimum: 0.05, maximum: 120 }
        }
      },
      diagnosticos: {
        bsonType: "array", minItems: 1,
        items: {
          bsonType: "object", required: ["codigo", "descripcion", "gravedad"],
          properties: {
            codigo: { bsonType: "string" }, descripcion: { bsonType: "string" },
            gravedad: { enum: ["leve", "moderada", "grave"] }
          }
        }
      },
      tratamientos: {
        bsonType: "array",
        items: {
          bsonType: "object", required: ["medicamento", "dosis", "frecuencia", "duracion_dias"],
          properties: {
            medicamento: { bsonType: "string" }, dosis: { bsonType: "string" }, frecuencia: { bsonType: "string" },
            duracion_dias: { bsonType: "number", minimum: 1, maximum: 365 }
          }
        }
      },
      observaciones: { bsonType: "string" },
      costo_cop:     { bsonType: "number", minimum: 0 }
    }
  } },
  validationLevel: "strict", validationAction: "error"
});

// 1.4 vacunas: referencia a mascota; lote embebido
bd.createCollection("vacunas", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["mascota_id", "nombre_vacuna", "enfermedad", "dosis_numero", "fecha_aplicacion", "proxima_dosis", "lote", "veterinario", "clinica"],
    properties: {
      mascota_id:       { bsonType: "objectId" },
      nombre_vacuna:    { bsonType: "string" },
      enfermedad:       { bsonType: "string" },
      dosis_numero:     { bsonType: "number", minimum: 1, maximum: 10 },
      fecha_aplicacion: { bsonType: "date" },
      proxima_dosis:    { bsonType: "date" },
      lote: {
        bsonType: "object", required: ["numero", "laboratorio", "vencimiento"],
        properties: { numero: { bsonType: "string" }, laboratorio: { bsonType: "string" }, vencimiento: { bsonType: "date" } }
      },
      veterinario: { bsonType: "string" },
      clinica:     { bsonType: "string" }
    }
  } },
  validationLevel: "strict", validationAction: "error"
});

// ---------------------------------------------------------------------
// 2. Propietarios (15)
//    [cedula, nombres, apellidos, barrio, calle, ciudad, celular, correo, fijo(opcional)]
// ---------------------------------------------------------------------
const propietarios = [
  ["40321456",   "Luz Marina",      "Rodriguez Beltran", "Barzal",         "Calle 38 # 30-15",    "Villavicencio", "310 245 8890", "luzmarina.rodriguez@example.com", "608 662 1234"],
  ["86045123",   "Carlos Andres",   "Pardo Gomez",       "La Grama",       "Carrera 22 # 12-40",  "Villavicencio", "312 876 4410", "carlos.pardo@example.com"],
  ["1121834567", "Yenny Paola",     "Castiblanco Diaz",  "Kirpas",         "Calle 15 # 40-22",    "Villavicencio", "320 118 7745", "yenny.castiblanco@example.com"],
  ["17321890",   "Jhon Fredy",      "Salcedo Mora",      "El Buque",       "Carrera 30 # 8-61",   "Villavicencio", "314 553 9021", "jhon.salcedo@example.com", "608 668 2045"],
  ["40398712",   "Marisol",         "Ortiz Vargas",      "Porfia",         "Manzana F Casa 14",   "Villavicencio", "301 774 3356", "marisol.ortiz@example.com"],
  ["17345678",   "Hector Julio",    "Baquero Ruiz",      "Los Maracos",    "Calle 45 # 18-30",    "Villavicencio", "315 902 6678", "hector.baquero@example.com"],
  ["1121901234", "Diana Carolina",  "Suarez Pineda",     "Centro",         "Carrera 33 # 38-12",  "Villavicencio", "318 340 1192", "diana.suarez@example.com", "608 671 5500"],
  ["86078901",   "Wilmer Alexander","Cortes Lozano",     "Villa Julia",    "Calle 7 # 52-18",     "Villavicencio", "311 685 2230", "wilmer.cortes@example.com"],
  ["40412345",   "Sandra Milena",   "Leon Aguirre",      "Emporio",        "Carrera 40 # 25-90",  "Villavicencio", "322 417 8803", "sandra.leon@example.com"],
  ["17389012",   "Edgar Orlando",   "Pineda Cardenas",   "La Esperanza",   "Calle 12 # 36-44",    "Villavicencio", "304 229 5517", "edgar.pineda@example.com"],
  ["1122123456", "Paola Andrea",    "Gutierrez Trujillo","Rosita",         "Carrera 19 # 4-27",   "Villavicencio", "313 760 4489", "paola.gutierrez@example.com"],
  ["86091234",   "Nelson Ivan",     "Rojas Herrera",     "Libertador",     "Calle 14 # 20-35",    "Acacias",       "316 508 7712", "nelson.rojas@example.com"],
  ["40287654",   "Gloria Esperanza","Tovar Millan",      "Los Centauros",  "Carrera 48 # 16-08",  "Villavicencio", "300 391 6640", "gloria.tovar@example.com", "608 664 7788"],
  ["1121765432", "Oscar Mauricio",  "Ramirez Sanchez",   "Centro",         "Carrera 6 # 9-15",    "Restrepo",      "317 842 3359", "oscar.ramirez@example.com"],
  ["1122345678", "Angie Lorena",    "Mendez Forero",     "Pueblo Nuevo",   "Calle 10 # 7-50",     "Granada",       "321 659 0087", "angie.mendez@example.com"]
];

bd.propietarios.insertMany(propietarios.map((p, i) => {
  const telefonos = [{ tipo: "celular", numero: p[6] }];
  if (p[8]) telefonos.push({ tipo: "fijo", numero: p[8] });
  return {
    _id: idProp(i + 1),
    cedula: p[0], nombres: p[1], apellidos: p[2], correo: p[7],
    telefonos: telefonos,
    direccion: { barrio: p[3], calle: p[4], ciudad: p[5], departamento: "Meta" },
    fecha_registro: fecha("2024-0" + ((i % 9) + 1) + "-1" + (i % 9) + "T15:00:00Z"),
    activo: true
  };
}));

// ---------------------------------------------------------------------
// 3. Mascotas (18)
//    [propietario, nombre, especie, raza, sexo, nacimiento, peso_kg, esterilizado, alergias, cronicas, microchip(opcional)]
// ---------------------------------------------------------------------
const mascotas = [
  [1,  "Toby",    "perro",  "Criollo",              "macho",  "2021-06-20", 18.5, true,  ["penicilina", "picadura de pulga"], ["dermatitis atopica"], "941000012345678"],
  [1,  "Michi",   "gato",   "Criollo",              "hembra", "2020-11-02", 4.1,  true,  [], []],
  [2,  "Rocky",   "perro",  "Pitbull",              "macho",  "2019-03-15", 28,   false, [], ["displasia de cadera"], "941000012345679"],
  [3,  "Luna",    "perro",  "Golden Retriever",     "hembra", "2020-01-09", 29.4, true,  ["pollo"], []],
  [4,  "Max",     "perro",  "Schnauzer",            "macho",  "2022-02-14", 8.3,  true,  [], []],
  [5,  "Nala",    "gato",   "Siames",               "hembra", "2023-04-01", 3.6,  false, [], []],
  [6,  "Firulais","perro",  "Pastor Aleman",        "macho",  "2018-08-30", 34,   true,  [], ["displasia de codo"]],
  [7,  "Coco",    "perro",  "French Poodle",        "macho",  "2017-12-12", 5.2,  true,  ["penicilina"], ["enfermedad periodontal"]],
  [8,  "Bruno",   "perro",  "Labrador",             "macho",  "2020-05-05", 38.5, true,  [], ["obesidad"]],
  [9,  "Mia",     "perro",  "Chihuahua",            "hembra", "2022-09-21", 2.1,  false, [], ["hipoglucemia"]],
  [10, "Simba",   "gato",   "Persa",                "macho",  "2021-02-17", 4.6,  true,  [], ["epifora cronica"]],
  [11, "Thor",    "perro",  "Rottweiler",           "macho",  "2019-10-10", 42,   false, ["picadura de garrapata"], []],
  [12, "Lola",    "perro",  "Beagle",               "hembra", "2023-01-25", 12.1, true,  [], []],
  [13, "Pelusa",  "conejo", "Enano Cabeza de Leon", "hembra", "2024-03-03", 1.8,  false, [], []],
  [14, "Kira",    "perro",  "Husky Siberiano",      "hembra", "2021-07-07", 23,   true,  [], []],
  [15, "Pepe",    "ave",    "Loro Amazonico",       "macho",  "2015-05-20", 0.42, false, [], []],
  [15, "Bella",   "perro",  "Pitbull",              "hembra", "2022-11-11", 25,   true,  ["sulfas"], []],
  [12, "Zeus",    "perro",  "Pastor Aleman",        "macho",  "2023-06-18", 31,   false, [], []]
];

bd.mascotas.insertMany(mascotas.map((m, i) => {
  const doc = {
    _id: idMasc(i + 1),
    propietario_id: idProp(m[0]),
    nombre: m[1], especie: m[2], raza: m[3], sexo: m[4],
    fecha_nacimiento: fecha(m[5] + "T00:00:00Z"),
    peso_kg: m[6], esterilizado: m[7],
    alergias: m[8], condiciones_cronicas: m[9],
    activa: true
  };
  if (m[10]) doc.microchip = { numero: m[10], fecha_implante: fecha("2022-01-10T00:00:00Z") };
  return doc;
}));

// ---------------------------------------------------------------------
// 4. Consultas (19)
//    [mascota, fecha, motivo, veterinario(1-4), temp_c, fc, peso, [codigo, descripcion, gravedad], tratamientos[[med, dosis, frecuencia, dias]], observaciones, costo]
// ---------------------------------------------------------------------
const consultas = [
  [1,  "2026-09-18T14:30:00Z", "Control dermatologico",             1, 38.6, 96,  18.5, ["DERM-01", "Dermatitis atopica", "moderada"],                    [["Oclacitinib", "16 mg", "cada 12 horas", 14]], "Control en 15 dias.", 85000],
  [1,  "2026-03-05T10:00:00Z", "Prurito intenso en el lomo",         1, 38.8, 100, 18.2, ["DERM-02", "Dermatitis alergica por picadura de pulga", "leve"], [["Afoxolaner", "68 mg", "dosis unica", 1]], "Se recomienda control de pulgas en el patio.", 70000],
  [2,  "2026-08-10T16:15:00Z", "Vomito y decaimiento",              2, 39.2, 180, 4.1,  ["GAS-03", "Gastroenteritis aguda", "moderada"],                  [["Metoclopramida", "2 mg", "cada 12 horas", 5]], "Dieta blanda por 3 dias.", 78000],
  [3,  "2026-07-22T09:40:00Z", "Cojera en pata trasera",            3, 38.5, 90,  28,   ["ORT-02", "Displasia de cadera", "moderada"],                    [["Meloxicam", "1.5 mg", "cada 24 horas", 7]], "Evitar saltos y escaleras. Solicitar radiografia.", 120000],
  [3,  "2026-02-10T11:00:00Z", "Vacunacion y control general",      3, 38.4, 88,  27.5, ["SAN-00", "Sin hallazgos patologicos", "leve"],                  [], "Paciente sano.", 45000],
  [4,  "2026-10-02T15:20:00Z", "Sacude la cabeza y mal olor en oido", 2, 38.9, 92, 29.4, ["OTI-01", "Otitis externa", "leve"],                            [["Gotas oticas (Otomax)", "5 gotas", "cada 12 horas", 10]], "Secar bien los oidos tras el bano.", 60000],
  [5,  "2026-06-14T10:30:00Z", "Control posoperatorio de castracion", 1, 38.4, 88, 8.3, ["QUI-01", "Posoperatorio de castracion", "leve"],                 [["Tramadol", "10 mg", "cada 12 horas", 3]], "Herida cicatriza bien. Retiro de puntos en 8 dias.", 150000],
  [6,  "2026-09-01T17:00:00Z", "Estornudos y secrecion nasal",      4, 39.4, 200, 3.6,  ["RES-01", "Rinotraqueitis felina", "moderada"],                  [["Doxiciclina", "25 mg", "cada 12 horas", 10]], "Aislar de otros gatos.", 80000],
  [7,  "2026-05-30T08:45:00Z", "Perdida de apetito y diarrea",      3, 38.7, 84,  34,   ["PAR-01", "Parasitosis intestinal por Giardia", "moderada"],     [["Fenbendazol", "500 mg", "cada 24 horas", 5]], "Desparasitar a los demas animales del hogar.", 75000],
  [8,  "2026-10-15T14:00:00Z", "Mal aliento y sarro",               4, 38.5, 110, 5.2,  ["DEN-01", "Enfermedad periodontal grado II", "moderada"],        [["Clindamicina", "75 mg", "cada 12 horas", 7]], "Profilaxis dental realizada bajo sedacion.", 180000],
  [9,  "2026-08-25T11:30:00Z", "Sobrepeso y fatiga al caminar",     1, 38.3, 80,  38.5, ["NUT-01", "Obesidad", "leve"],                                   [["Alimento terapeutico light", "250 g", "cada 12 horas", 60]], "Plan de ejercicio: 2 caminatas diarias.", 50000],
  [10, "2026-09-09T07:50:00Z", "Temblores y debilidad",             2, 37.9, 130, 2.1,  ["END-01", "Hipoglucemia", "grave"],                              [["Dextrosa al 5%", "5 ml", "dosis unica", 1]], "Alimentar cada 4 horas. Evitar ayunos prolongados.", 110000],
  [11, "2026-07-07T13:10:00Z", "Lagrimeo constante en ojo derecho", 4, 38.8, 190, 4.6,  ["OFT-01", "Conjuntivitis", "leve"],                              [["Tobramicina colirio", "1 gota", "cada 8 horas", 7]], "Limpiar el contorno del ojo con suero.", 55000],
  [12, "2026-10-20T10:20:00Z", "Fiebre y garrapatas",               3, 40.1, 120, 42,   ["HEM-01", "Ehrlichiosis canina", "grave"],                       [["Doxiciclina", "200 mg", "cada 12 horas", 28]], "Control de hemograma en 15 dias. Fumigar el patio.", 220000],
  [13, "2026-04-18T09:00:00Z", "Control general y vacunacion",      1, 38.5, 92,  12.1, ["SAN-00", "Sin hallazgos patologicos", "leve"],                  [], "Paciente sano.", 45000],
  [14, "2026-09-27T16:40:00Z", "Diarrea y poco apetito",            2, 38.9, 160, 1.8,  ["GAS-04", "Disbacteriosis cecal", "moderada"],                   [["Probiotico para conejos", "1 ml", "cada 12 horas", 7]], "Aumentar heno en la dieta.", 65000],
  [15, "2026-08-03T12:30:00Z", "Jadeo y decaimiento tras paseo al sol", 3, 41.0, 150, 23, ["TER-01", "Golpe de calor", "grave"],                          [["Suero Ringer lactato", "500 ml", "dosis unica", 1]], "Evitar ejercicio en horas de calor (clima llanero).", 190000],
  [16, "2026-06-22T15:00:00Z", "Se arranca las plumas",             4, 41.5, 280, 0.42, ["DERM-05", "Picaje de plumas por estres", "leve"],               [["Complejo vitaminico aviar", "2 gotas", "cada 24 horas", 15]], "Enriquecimiento ambiental y mas horas de juego.", 40000],
  [17, "2026-10-05T18:10:00Z", "Heridas por mordedura",             1, 38.6, 100, 25,   ["TRA-01", "Heridas por mordedura", "moderada"],                  [["Amoxicilina con clavulanico", "500 mg", "cada 12 horas", 10]], "Curaciones diarias de las heridas.", 130000]
];

bd.consultas.insertMany(consultas.map((c, i) => ({
  _id: oid(0x200 + i + 1),
  mascota_id: idMasc(c[0]),
  fecha: fecha(c[1]),
  motivo: c[2],
  veterinario: vets[c[3] - 1],
  signos_vitales: { temperatura_c: c[4], frecuencia_cardiaca: c[5], peso_kg: c[6] },
  diagnosticos: [{ codigo: c[7][0], descripcion: c[7][1], gravedad: c[7][2] }],
  tratamientos: c[8].map((t) => ({ medicamento: t[0], dosis: t[1], frecuencia: t[2], duracion_dias: t[3] })),
  observaciones: c[9],
  costo_cop: c[10]
})));

// Patron "subset": copia en cada mascota el resumen de su consulta mas reciente
bd.mascotas.find().forEach((m) => {
  const ultima = bd.consultas.find({ mascota_id: m._id }).sort({ fecha: -1 }).limit(1).toArray()[0];
  if (ultima) {
    bd.mascotas.updateOne({ _id: m._id }, { $set: { ultima_consulta: { fecha: ultima.fecha, motivo: ultima.motivo } } });
  }
});

// ---------------------------------------------------------------------
// 5. Vacunas (20)
//    [mascota, vacuna, enfermedad, dosis, aplicacion, proxima_dosis, numero_lote, laboratorio, veterinario(1-4)]
//    Hay proximas dosis cercanas a la fecha de uso (nov-dic 2026) y algunas atrasadas, para las consultas.
// ---------------------------------------------------------------------
const vacunas = [
  [1,  "Rabia",              "Rabia",                                     1, "2025-11-25", "2026-11-25", "RB2511-A", "Zoetis",              1],
  [1,  "Parvovirus canino",  "Parvovirosis",                              3, "2026-04-15", "2027-04-15", "L2403-BX", "Zoetis",              1],
  [2,  "Triple felina",      "Panleucopenia, rinotraqueitis y calicivirus", 2, "2025-12-03", "2026-12-03", "TF2512-C", "MSD Animal Health",   2],
  [3,  "Rabia",              "Rabia",                                     1, "2025-12-10", "2026-12-10", "RB2512-B", "Zoetis",              3],
  [3,  "Sextuple canina",    "Moquillo, hepatitis, parvovirus, parainfluenza, leptospirosis", 3, "2026-02-10", "2027-02-10", "SX2601-D", "Boehringer Ingelheim", 3],
  [4,  "Rabia",              "Rabia",                                     1, "2026-01-20", "2027-01-20", "RB2601-A", "Zoetis",              2],
  [4,  "Leptospirosis",      "Leptospirosis",                             2, "2026-01-20", "2027-01-20", "LP2601-E", "Virbac",              2],
  [5,  "Sextuple canina",    "Moquillo, hepatitis, parvovirus, parainfluenza, leptospirosis", 3, "2026-03-12", "2027-03-12", "SX2603-F", "Boehringer Ingelheim", 1],
  [6,  "Triple felina",      "Panleucopenia, rinotraqueitis y calicivirus", 1, "2026-05-04", "2026-06-04", "TF2605-G", "MSD Animal Health",   4],
  [7,  "Rabia",              "Rabia",                                     1, "2026-05-30", "2027-05-30", "RB2605-H", "Zoetis",              3],
  [8,  "Sextuple canina",    "Moquillo, hepatitis, parvovirus, parainfluenza, leptospirosis", 4, "2025-11-18", "2026-11-18", "SX2511-J", "Boehringer Ingelheim", 4],
  [9,  "Rabia",              "Rabia",                                     1, "2026-08-25", "2027-08-25", "RB2608-K", "Zoetis",              1],
  [10, "Parvovirus canino",  "Parvovirosis",                              2, "2026-01-15", "2026-02-15", "PV2601-L", "Virbac",              2],
  [11, "Triple felina",      "Panleucopenia, rinotraqueitis y calicivirus", 3, "2025-11-30", "2026-11-30", "TF2511-M", "MSD Animal Health",   4],
  [12, "Rabia",              "Rabia",                                     1, "2025-09-01", "2026-09-01", "RB2509-N", "Zoetis",              3],
  [13, "Sextuple canina",    "Moquillo, hepatitis, parvovirus, parainfluenza, leptospirosis", 3, "2026-04-18", "2027-04-18", "SX2604-P", "Boehringer Ingelheim", 1],
  [14, "Mixomatosis",        "Mixomatosis y enfermedad hemorragica viral", 1, "2026-03-03", "2027-03-03", "MX2603-Q", "Virbac",              2],
  [15, "Rabia",              "Rabia",                                     1, "2026-02-02", "2027-02-02", "RB2602-R", "Zoetis",              3],
  [17, "Bordetella",         "Tos de las perreras",                       1, "2026-10-05", "2027-04-05", "BD2610-S", "MSD Animal Health",   1],
  [18, "Sextuple canina",    "Moquillo, hepatitis, parvovirus, parainfluenza, leptospirosis", 2, "2026-07-01", "2027-07-01", "SX2607-T", "Boehringer Ingelheim", 3]
];

bd.vacunas.insertMany(vacunas.map((v, i) => ({
  _id: oid(0x300 + i + 1),
  mascota_id: idMasc(v[0]),
  nombre_vacuna: v[1], enfermedad: v[2], dosis_numero: v[3],
  fecha_aplicacion: fecha(v[4] + "T00:00:00Z"),
  proxima_dosis: fecha(v[5] + "T00:00:00Z"),
  lote: { numero: v[6], laboratorio: v[7], vencimiento: sumarMeses(fecha(v[4] + "T00:00:00Z"), 12) },
  veterinario: vets[v[8] - 1].nombre,
  clinica: vets[v[8] - 1].clinica
})));

// ---------------------------------------------------------------------
// 6. Prueba de validacion: documentos INVALIDOS que deben ser rechazados
//    (evidencia para el entregable: captura de estos mensajes)
// ---------------------------------------------------------------------
print("\n=== PRUEBAS DE VALIDACION $jsonSchema ===");

// 6.1 Mascota invalida: sin propietario_id, especie fuera del catalogo y peso negativo
try {
  bd.mascotas.insertOne({
    nombre: "Draco",
    especie: "dragon",       // no esta en el enum
    sexo: "macho",
    fecha_nacimiento: fecha("2024-01-01T00:00:00Z"),
    peso_kg: -5,             // fuera del rango permitido
    esterilizado: false,
    activa: true
    // falta propietario_id (campo obligatorio)
  });
  print("ERROR: el documento invalido fue aceptado (no deberia pasar)");
} catch (e) {
  print("OK - mascota invalida rechazada: " + e.message + " (codigo " + e.code + ")");
}

// 6.2 Propietario invalido: telefono con formato no colombiano y sin direccion
try {
  bd.propietarios.insertOne({
    cedula: "ABC123",                                   // no cumple el patron numerico
    nombres: "Pedro", apellidos: "Perez",
    telefonos: [{ tipo: "celular", numero: "12345" }],   // formato invalido
    fecha_registro: fecha("2026-01-01T00:00:00Z"),
    activo: true
    // falta direccion (campo obligatorio)
  });
  print("ERROR: el documento invalido fue aceptado (no deberia pasar)");
} catch (e) {
  print("OK - propietario invalido rechazado: " + e.message + " (codigo " + e.code + ")");
}

// ---------------------------------------------------------------------
// 7. Resumen final
// ---------------------------------------------------------------------
print("\n=== RESUMEN DE DOCUMENTOS INSERTADOS ===");
["propietarios", "mascotas", "consultas", "vacunas"].forEach((c) => {
  print(c.padEnd(14) + ": " + bd[c].countDocuments());
});
