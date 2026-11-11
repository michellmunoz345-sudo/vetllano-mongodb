# VetLlano – Base de datos MongoDB para registro de mascotas y servicios veterinarios

Proyecto #7 de **Bases de Datos II** (AUNAR Villavicencio, Ingeniería Informática).
Capa de datos en MongoDB para clínicas veterinarias de Villavicencio y el Meta: propietarios, mascotas, historial clínico (consultas) y carnet de vacunación.

Este README permite levantar todo desde cero en **Windows**, con autenticación activa y usuarios con mínimo privilegio.

## Modelo de datos

Base de datos: `vetllano`. Colecciones: `propietarios`, `mascotas`, `consultas`, `vacunas`.

```
propietarios 1 ──< mascotas 1 ──< consultas
                        └──────< vacunas
```

| Relación | Decisión | Por qué |
|---|---|---|
| Propietario → dirección y teléfonos | **Embebido** | Se leen siempre juntos y son pocos. |
| Propietario → mascota | **Referenciado** (`propietario_id`) | Las mascotas se consultan por separado y pueden cambiar de dueño. |
| Mascota → microchip, alergias, condiciones crónicas, `ultima_consulta` | **Embebido** | Datos propios, acotados, se leen con la mascota. |
| Mascota → consulta | **Referenciado** (`mascota_id`) | El historial crece sin límite. Dentro de la consulta se embeben `veterinario`, `signos_vitales`, `diagnosticos[]` y `tratamientos[]`. |
| Mascota → vacuna | **Referenciado** (`mascota_id`) | Se consultan de forma transversal (refuerzos próximos). El `lote` va embebido. |

Regla general: se embebe lo que se lee junto y es pequeño o acotado; se referencia lo que crece sin límite o se consulta de forma independiente.

Las cuatro colecciones tienen validación `$jsonSchema` (campos obligatorios, tipos, `enum` y rangos).

**Qué parte sería mejor en SQL:** facturación y pagos, inventario de medicamentos y agenda de citas con reglas de no solapamiento.

## Requisitos

| Herramienta | Para qué | Instalación |
|---|---|---|
| MongoDB Server 8.x | Base de datos | Instalador oficial (como servicio de Windows) |
| MongoDB Shell (`mongosh`) | Ejecutar los scripts `.js` | `winget install MongoDB.Shell` |
| MongoDB Database Tools | `mongodump` y `mongorestore` | `winget install MongoDB.DatabaseTools` |
| Python 3.10+ | Programa de conexión | python.org |

Después de instalar, abre una **PowerShell nueva** para que reconozca los comandos.

## Estructura del repositorio

```
proyecto-veterinaria/
├── README.md                 Este archivo
├── .env.example              Plantilla de variables de entorno (sin contraseñas reales)
├── .gitignore                Excluye .env, .venv, respaldo/ y .zip
├── datos_iniciales.js        Crea colecciones con $jsonSchema e inserta los datos
├── consultas.js              10 consultas, 4 actualizaciones, 3 agregaciones, 3 índices con explain
├── crear_usuarios.js         Crea el usuario administrador y el de aplicación
├── crud_veterinaria.py       Programa Python (PyMongo) con CRUD completo
├── requirements.txt          Dependencias de Python
├── config/
│   └── mongod.cfg            Configuración del servidor con la sección security
├── GUIA_SEGURIDAD.md         Autenticación, usuarios y pruebas de mínimo privilegio
└── GUIA_RESPALDO.md          mongodump y mongorestore paso a paso
```

## Levantar todo desde cero

Todos los comandos son de **PowerShell**, desde la carpeta del proyecto.

### 1. Cargar los datos

Con MongoDB en ejecución (`Get-Service MongoDB` debe decir `Running`):

```powershell
mongosh datos_iniciales.js
```

Crea la base `vetllano`, aplica la validación, inserta 15 propietarios, 18 mascotas, 19 consultas y 20 vacunas, y prueba dos documentos inválidos que deben ser rechazados (código 121). El script se puede volver a ejecutar: borra las colecciones y las recrea.

### 2. Crear los usuarios

```powershell
mongosh crear_usuarios.js
```

Pide por consola dos contraseñas (no se escriben en ningún archivo):

| Usuario | Base de autenticación | Rol | Uso |
|---|---|---|---|
| `admin_mongo` | `admin` | `root` | Solo administración. Nunca en la aplicación. |
| `app_vetllano` | `vetllano` | `readWrite` sobre `vetllano` | Scripts y programa Python. |

### 3. Activar la autenticación

El servicio debe arrancar con un archivo de configuración que tenga `security.authorization: enabled`. Los pasos completos (copiar `config\mongod.cfg` a `C:\data\mongod.cfg` y reinstalar el servicio con `--config`) están en **[GUIA_SEGURIDAD.md](GUIA_SEGURIDAD.md)**.

Los datos y los usuarios se conservan porque el `dbPath` (`C:\data\db`) es el mismo.

### 4. Ejecutar los scripts con el usuario de aplicación

Con la autenticación activa, los scripts se ejecutan con `app_vetllano` (pide la contraseña):

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file datos_iniciales.js
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file consultas.js
```

`consultas.js` modifica datos (actualizaciones y upsert). Para volver al estado original, ejecuta de nuevo `datos_iniciales.js`.

### 5. Programa Python con CRUD

```powershell
Copy-Item .env.example .env
notepad .env
```

En `.env`, reemplaza `CAMBIAR_POR_TU_CONTRASENA` por la contraseña de `app_vetllano`. El archivo `.env` está en `.gitignore` y **no se sube a GitHub**.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python crud_veterinaria.py
```

Muestra el usuario con el que se conectó (debe ser `app_vetllano`) y ejecuta Create, Read, Update y Delete sobre `propietarios` y `mascotas` con datos de prueba que elimina al terminar.

### 6. Respaldo y restauración

Con `mongodump` y `mongorestore` usando el usuario de aplicación. Pasos completos en **[GUIA_RESPALDO.md](GUIA_RESPALDO.md)**. Resumen:

```powershell
$fecha = Get-Date -Format "yyyy-MM-dd"
mongodump --host localhost --port 27017 --username app_vetllano --authenticationDatabase vetllano --db vetllano --out "respaldo\vetllano_$fecha"
mongorestore --host localhost --port 27017 --username app_vetllano --authenticationDatabase vetllano --db vetllano --drop "respaldo\vetllano_$fecha\vetllano"
```

La carpeta `respaldo/` no se sube a GitHub; solo va en el `.zip` de entrega.

## Las 5 consultas clave del negocio

| # | Pregunta | En `consultas.js` |
|---|---|---|
| 1 | Historial clínico de una mascota | C1 |
| 2 | Vacunas próximas a vencer (30 días) | C2, A3 |
| 3 | Mascotas de un propietario (por cédula o celular) | C4 |
| 4 | Mascotas con alergias o condiciones crónicas | C5, C6 |
| 5 | Diagnósticos más frecuentes por gravedad | A2 |

## Seguridad

- Autenticación activa (`security.authorization: enabled`) y `bindIp: 127.0.0.1`.
- La aplicación usa `app_vetllano` con `readWrite` solo sobre `vetllano`; nunca el administrador.
- Ninguna contraseña está en el código ni en el repositorio: se piden por consola (`passwordPrompt()`) o se leen de `.env`.
- Índice único en `propietarios.cedula` para evitar clientes duplicados.

## Proyección a futuro

API REST (Flask, FastAPI o Express), migración a MongoDB Atlas, replica set con transacciones, persistencia poliglota con una base relacional o Redis para facturación e inventario, y análisis en Power BI o Python.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `mongosh` o `mongodump` no se reconocen | Instálalos (ver Requisitos) y abre una PowerShell nueva. |
| `Authentication failed` | La base de autenticación es `vetllano` para `app_vetllano` y `admin` para `admin_mongo`. |
| `requires authentication` al ejecutar scripts | La autenticación ya está activa: usa `-u app_vetllano -p --authenticationDatabase vetllano`. |
| El servicio no arranca tras activar la seguridad | Revisa `C:\data\db\mongod.log`; suele ser la sangría del YAML. |
| El programa Python dice que defina `MONGO_URI` | Copia `.env.example` como `.env` y escribe la contraseña real. |
