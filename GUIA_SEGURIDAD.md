# Guía de seguridad de MongoDB en Windows – VetLlano

Objetivo: autenticación activa, un usuario administrador y un usuario de aplicación con `readWrite` solo sobre la base `vetllano`.

> Todos los comandos se escriben en **PowerShell**. Los pasos 5 y 6 requieren abrirlo **como administrador** (clic derecho en PowerShell → *Ejecutar como administrador*).

## Paso 0. Herramientas necesarias

Tu equipo tiene `mongod` pero no tiene `mongosh` ni las herramientas de respaldo. Instálalas y abre una **PowerShell nueva** para que reconozca los comandos:

```powershell
winget install MongoDB.Shell
winget install MongoDB.DatabaseTools
mongosh --version
```

## Paso 1. Comprobar que el servicio está activo

```powershell
Get-Service MongoDB
```

Debe decir `Running`. Ahora mismo la autenticación está **desactivada**, por eso este es el momento de crear los usuarios.

## Paso 2. Cargar los datos (opcional en este punto)

Si todavía no lo hiciste, desde la carpeta del proyecto:

```powershell
cd C:\Users\MICHEL\Documents\proyecto-veterinaria
mongosh datos_iniciales.js
```

## Paso 3. Crear el administrador y el usuario de aplicación

```powershell
mongosh crear_usuarios.js
```

El script te pedirá **dos contraseñas por consola**, primero la del administrador (`admin_mongo`) y luego la de la aplicación (`app_vetllano`). Se escriben sin que se vean en pantalla.

- Usa contraseñas distintas entre sí, largas y solo con letras y números (evitas problemas en la cadena de conexión).
- Anótalas en un lugar seguro. **No** las pongas en ningún archivo del repositorio.

Resultado esperado: dos mensajes de "creado", y los roles `root` (admin) y `readWrite` sobre `vetllano` (aplicación).

## Paso 4. Crear el archivo de configuración real

Tu servicio hoy arranca solo con banderas de línea de comandos y no usa ningún archivo de configuración. El `mongod.cfg` de la carpeta `bin` es una plantilla sin usar. Crea uno real, con la sección `security`:

```powershell
Copy-Item .\config\mongod.cfg C:\data\mongod.cfg
Get-Content C:\data\mongod.cfg
```

Debe contener, entre otras cosas:

```yaml
security:
  authorization: enabled
```

> 📸 **Captura de evidencia:** el contenido de `C:\data\mongod.cfg` mostrando la sección `security`.

## Paso 5. Apuntar el servicio al archivo de configuración (PowerShell como administrador)

Los datos de `C:\data\db` **se conservan**, porque el `dbPath` es el mismo.

```powershell
# 1. Detener el servicio
net stop MongoDB

# 2. Quitar la definición actual del servicio
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --remove --serviceName MongoDB

# 3. Volver a instalarlo usando el archivo de configuración
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --config "C:\data\mongod.cfg" --install --serviceName MongoDB --serviceDisplayName "MongoDB"

# 4. Iniciarlo
net start MongoDB
```

Verifica que arrancó:

```powershell
Get-Service MongoDB
```

Si no arranca, revisa el final de `C:\data\db\mongod.log` (casi siempre es un error de sintaxis en el YAML, como una sangría mal puesta).

## Paso 6. Comprobar que la autenticación está activa

**6.1. Sin credenciales no debe dejar leer datos:**

```powershell
mongosh "mongodb://localhost:27017/vetllano" --eval "db.propietarios.find().toArray()"
```

Resultado esperado: error `Command find requires authentication`.

> 📸 **Captura de evidencia:** ese error.

**6.2. Con el usuario de aplicación sí funciona** (te pide la contraseña):

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "db.propietarios.countDocuments()"
```

Debe devolver `15` (o `16` si ya ejecutaste el upsert de `consultas.js`).

> 📸 **Captura de evidencia:** la conexión con `app_vetllano` y el conteo.

**6.3. El usuario de aplicación no debe poder hacer tareas de administración** (prueba de mínimo privilegio):

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "db.getSiblingDB('admin').getUsers()"
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "db.getSiblingDB('test').prueba.insertOne({a:1})"
```

Resultado esperado: ambos fallan con `not authorized`.

> 📸 **Captura de evidencia:** esos errores `not authorized`.

**6.4. El administrador sí puede ver los usuarios:**

```powershell
mongosh "mongodb://localhost:27017/admin" -u admin_mongo -p --authenticationDatabase admin --eval "db.getUsers()"
```

## Paso 7. Ejecutar los scripts del proyecto con autenticación

Con la autenticación activa, los scripts se ejecutan con el **usuario de aplicación**, que tiene permiso para crear colecciones, insertar, actualizar y crear índices en `vetllano`:

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file datos_iniciales.js
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --file consultas.js
```

## Paso 8. Crear tu archivo `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Reemplaza `CAMBIAR_POR_TU_CONTRASENA` por la contraseña real de `app_vetllano`. El archivo `.env` ya está en `.gitignore`, por lo que no se sube a GitHub. Verifícalo cuando tengas el repositorio con `git status`: `.env` no debe aparecer.

## Resumen de usuarios

| Usuario | Base de autenticación | Rol | Uso |
|---|---|---|---|
| `admin_mongo` | `admin` | `root` | Solo administración: usuarios, respaldos. Nunca en la aplicación. |
| `app_vetllano` | `vetllano` | `readWrite` sobre `vetllano` | Scripts y programa Python. |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Authentication failed` | La base de autenticación es incorrecta: `app_vetllano` se autentica en `vetllano` y `admin_mongo` en `admin` (`--authenticationDatabase`). |
| `net start MongoDB` falla | Revisa `C:\data\db\mongod.log`; suele ser sangría del YAML o ruta mal escrita. |
| `Access is denied` en el paso 5 | PowerShell no está abierto como administrador. |
| `mongosh` no se reconoce | Cierra y abre una PowerShell nueva tras instalarlo (paso 0). |
