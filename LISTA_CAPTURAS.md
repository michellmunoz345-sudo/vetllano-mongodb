# Lista de capturas de evidencia – VetLlano

Organizada por fase de la actividad y por criterio de la rúbrica. Guarda las imágenes en una carpeta `capturas/` con el nombre sugerido (así las encuentras al armar el PDF de diseño y para la sustentación).

## Antes de empezar

- **Nunca muestres contraseñas.** `mongosh -p` y `mongodump` las piden sin mostrarlas; no captures el `.env` abierto con la contraseña real.
- Que se vea la **ventana completa** de PowerShell con el comando y su resultado.
- Si una captura es larga, toma varias seguidas en vez de recortar el comando.
- Las capturas deben hacerse con la **autenticación ya activa**, salvo las indicadas como "antes".

---

## Fase 1. Análisis y diseño (20 %)

| # | Archivo sugerido | Qué debe verse | Cómo se obtiene |
|---|---|---|---|
| 1 | `01_diagrama_modelo.png` | Diagrama del modelo de documentos con las 4 colecciones, campos, tipos y relaciones (embebido y referenciado diferenciados). | Se dibuja en **draw.io** o Hackolade. Esto no lo genera el repositorio: debes hacerlo tú a partir de la tabla del `README.md`. |

---

## Fase 2. Instalación, configuración y seguridad (15 %)

| # | Archivo sugerido | Qué debe verse | Comando |
|---|---|---|---|
| 2 | `02_mongod_cfg.png` | Contenido de `C:\data\mongod.cfg` con la sección `security: authorization: enabled`. | `Get-Content C:\data\mongod.cfg` |
| 3 | `03_servicio_con_config.png` | El servicio `Running` y su ruta incluyendo `--config "C:\data\mongod.cfg"`. | `Get-Service MongoDB` y `(Get-CimInstance Win32_Service -Filter "Name='MongoDB'").PathName` |
| 4 | `04_usuarios_creados.png` | Salida de `crear_usuarios.js` con los dos usuarios creados y sus roles (`root` y `readWrite` sobre `vetllano`). Si ya los creaste antes, usa la captura 7. | `mongosh crear_usuarios.js` (solo funciona con la autenticación apagada) |
| 5 | `05_sin_credenciales.png` | Error `Command find requires authentication` al consultar sin usuario. | `mongosh "mongodb://localhost:27017/vetllano" --eval "db.propietarios.find().toArray()"` |
| 6 | `06_conexion_app.png` | Conexión exitosa con `app_vetllano` y el conteo de propietarios. | `mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "db.propietarios.countDocuments()"` |
| 7 | `07_no_autorizado.png` | Los dos errores `not authorized` del usuario de aplicación (prueba de mínimo privilegio). | Los dos comandos del paso 6.3 de `GUIA_SEGURIDAD.md` |
| 8 | `08_admin_usuarios.png` | El administrador listando los usuarios (roles visibles, sin hashes de contraseña). | Comando 6.4 de `GUIA_SEGURIDAD.md` |

---

## Fase 3. Implementación y validación (15 %)

| # | Archivo sugerido | Qué debe verse | Comando |
|---|---|---|---|
| 9 | `09_datos_iniciales.png` | Salida completa de `datos_iniciales.js`: las dos pruebas de documentos rechazados (`OK - mascota invalida rechazada ... codigo 121`, `OK - propietario invalido rechazado ...`) y el resumen de documentos por colección (15, 18, 19, 20). | `mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file datos_iniciales.js` |
| 10 | `10_validador_json_schema.png` | La validación `$jsonSchema` de una colección. | `mongosh ... --eval "printjson(db.getCollectionInfos({name:'mascotas'})[0].options)"` |
| 11 | `11_compass_colecciones.png` | **MongoDB Compass** conectado con `app_vetllano`, mostrando la base `vetllano` con sus 4 colecciones y los conteos. | Compass (ya viene instalado con MongoDB) |
| 12 | `12_documento_embebido.png` | En Compass, un documento de `consultas` con `veterinario`, `signos_vitales`, `diagnosticos` y `tratamientos` desplegados (caso embebido). | Compass → `vetllano.consultas` |
| 13 | `13_documento_referencia.png` | En Compass, un documento de `mascotas` con `propietario_id` (caso referenciado) junto al propietario correspondiente. | Compass → `vetllano.mascotas` y `vetllano.propietarios` |

> La captura 9 es la **evidencia clave de `$jsonSchema`** que pide la rúbrica. Asegúrate de que se lean los dos rechazos.

---

## Fase 4. Consultas, actualizaciones y agregaciones (25 %) e índices (10 %)

Ejecuta `consultas.js` con el usuario de aplicación y captura por tramos (la salida es larga):

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file consultas.js
```

| # | Archivo sugerido | Qué debe verse |
|---|---|---|
| 14 | `14_consultas_c1_c5.png` | Títulos "C1" a "C5", con la **pregunta de negocio** y los resultados. |
| 15 | `15_consultas_c6_c10.png` | Títulos "C6" a "C10" con sus resultados. |
| 16 | `16_actualizaciones.png` | U1 a U4, con el estado **antes y después**. En U4 deben verse la primera ejecución (`upsertedCount: 1`) y la segunda (`matchedCount: 1`, sin duplicar). |
| 17 | `17_agregaciones_a1_a2.png` | A1 (ingresos por barrio, con `$lookup`) y A2 (diagnósticos por gravedad, con `$unwind` + `$group`). |
| 18 | `18_agregacion_a3.png` | A3 (recordatorios de vacunación con estado `VENCIDA` y `PROXIMA`). |
| 19 | `19_indice_unico.png` | I1: explain **antes** (`COLLSCAN`) y **después** (`IXSCAN`) de `cedula_unica`, y el rechazo del duplicado (código 11000). |
| 20 | `20_indice_compuesto.png` | I2: explain antes (con etapa `SORT` y `COLLSCAN`) y después (`IXSCAN`, sin `SORT`) del índice `mascota_fecha`. |
| 21 | `21_indice_simple.png` | I3: explain antes y después del índice `proxima_dosis`. |

> En las capturas 19 a 21 deben verse **las dos cifras clave**: "Documentos examinados" antes y después. Esa comparación, más tu interpretación escrita, es lo que evalúa el criterio de índices.

---

## Fase 5. Respaldo y conexión desde código (10 %)

| # | Archivo sugerido | Qué debe verse | Comando |
|---|---|---|---|
| 22 | `22_conteos_antes.png` | Conteos de las 4 colecciones **antes** del respaldo. | Comando 1 de los comandos de respaldo |
| 23 | `23_mongodump.png` | Salida de `mongodump` con `done dumping vetllano.<coleccion>` por cada colección. | `mongodump ...` |
| 24 | `24_archivos_respaldo.png` | La carpeta del respaldo con los `.bson` y `.metadata.json`. | `Get-ChildItem "respaldo\vetllano_<fecha>\vetllano"` |
| 25 | `25_coleccion_borrada.png` | `vacunas: 0` tras borrar la colección (pérdida simulada). | Comandos 4 y 5 |
| 26 | `26_mongorestore.png` | Salida de `mongorestore` con `finished restoring ... 0 failures`. | `mongorestore ...` |
| 27 | `27_conteos_despues.png` | Conteos **después** de restaurar, **iguales** a los del paso 22, junto con la verificación de validación e índices. | Comandos 7 y 8 |
| 28 | `28_python_crud.png` | Ejecución completa de `crud_veterinaria.py`: primera línea con `app_vetllano`, las secciones C, R, U y D y el mensaje final `CRUD completado correctamente.` | `python crud_veterinaria.py` |
| 29 | `29_python_validacion.png` | De la misma ejecución, los rechazos de la validación (código 121) y de la cédula duplicada (código 11000). | (parte de la salida anterior; si no cabe, captura aparte) |
| 30 | `30_env_sin_clave.png` | El archivo `.env.example` abierto (con el texto de relleno, **no** el `.env` real) y el `.gitignore` con `.env`. | Editor de texto |

> **Sobre tu respaldo actual:** la carpeta quedó como `respaldo\vetllano_` sin fecha. Sirve igual para la evidencia. Si quieres que las capturas muestren el nombre con fecha, rehaz el respaldo en una sola sesión de PowerShell, sin cerrarla entre pasos.

---

## Repositorio y entrega

| # | Archivo sugerido | Qué debe verse |
|---|---|---|
| 31 | `31_git_status.png` | `git status` mostrando que `.env`, `.venv/` y `respaldo/` **no** aparecen para subir. Requiere antes `git init`. |
| 32 | `32_github_repo.png` | El repositorio en GitHub con el `README.md` visible y los archivos del proyecto (sin `.env`). |

---

## Resumen por criterio de la rúbrica

| Criterio | Peso | Capturas |
|---|---|---|
| Análisis y modelado | 20 % | 1, 12, 13 |
| Instalación, configuración y seguridad | 15 % | 2 a 8 |
| Implementación y validación | 15 % | 9 a 13 |
| Consultas, actualizaciones y agregaciones | 25 % | 14 a 18 |
| Índices y rendimiento | 10 % | 19 a 21 |
| Respaldo y conexión desde código | 10 % | 22 a 30 |
| Sustentación | 5 % | Repaso del `README.md` y de la tabla de embebidos y referencias |

## Para el PDF de diseño (fases 1 y 2)

El PDF debe llevar: descripción y usuarios, las 5 consultas clave, justificación de MongoDB y qué iría en SQL, el diagrama (captura 1), la tabla de embeber o referenciar, un JSON de ejemplo por colección y las capturas 2 a 8 de seguridad. Todo ese contenido ya está en la Fase 0 de esta conversación y en el `README.md`.
