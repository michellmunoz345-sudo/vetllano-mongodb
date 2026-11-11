# Guía de respaldo y restauración – VetLlano (Windows)

Respaldo con `mongodump` y restauración con `mongorestore` usando el **usuario de aplicación** (`app_vetllano`). Como tiene `readWrite` sobre `vetllano`, alcanza para respaldar y restaurar esta base sin necesitar al administrador.

> Todos los comandos son para **PowerShell**, desde la carpeta del proyecto. Cada comando te pedirá la contraseña de `app_vetllano` (se escribe sin verse en pantalla). No la escribas dentro del comando.

## Paso 0. Verificar las herramientas

```powershell
cd C:\Users\MICHEL\Documents\proyecto-veterinaria
mongodump --version
mongorestore --version
```

Si no se reconocen, instala `winget install MongoDB.DatabaseTools` y abre una PowerShell nueva.

## Paso 1. Anotar cuántos documentos hay antes del respaldo

Servirá para comprobar que la restauración quedó completa.

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "['propietarios','mascotas','consultas','vacunas'].forEach(c => print(c + ': ' + db[c].countDocuments()))"
```

> 📸 **Captura de evidencia:** los conteos ANTES (por ejemplo 16, 18, 19 y 20 si ya corriste `consultas.js`, que agrega un propietario por el upsert).

## Paso 2. Hacer el respaldo con `mongodump`

```powershell
$fecha = Get-Date -Format "yyyy-MM-dd"
mongodump --host localhost --port 27017 --username app_vetllano --authenticationDatabase vetllano --db vetllano --out "respaldo\vetllano_$fecha"
```

Resultado esperado: una línea `done dumping vetllano.<coleccion> (N documents)` por cada una de las 4 colecciones.

> 📸 **Captura de evidencia:** la salida de `mongodump`.

## Paso 3. Revisar qué se generó

```powershell
Get-ChildItem "respaldo\vetllano_$fecha\vetllano"
```

Por cada colección verás dos archivos:

| Archivo | Contenido |
|---|---|
| `<coleccion>.bson` | Los documentos en formato binario. |
| `<coleccion>.metadata.json` | Los índices y las opciones de la colección, incluida la validación `$jsonSchema`. |

> 📸 **Captura de evidencia:** el listado de archivos.

## Paso 4. Simular una pérdida de datos

Se borra la colección `vacunas`, que el usuario de aplicación sí puede eliminar:

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "db.vacunas.drop()"
```

Comprueba que ya no existe (conteo en 0):

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "print('vacunas: ' + db.vacunas.countDocuments())"
```

> 📸 **Captura de evidencia:** `vacunas: 0`.

## Paso 5. Restaurar con `mongorestore`

```powershell
mongorestore --host localhost --port 27017 --username app_vetllano --authenticationDatabase vetllano --db vetllano --drop "respaldo\vetllano_$fecha\vetllano"
```

`--drop` borra cada colección antes de restaurarla para evitar duplicados.

Resultado esperado: `finished restoring vetllano.<coleccion> (N documents, 0 failures)` para las cuatro colecciones.

> 📸 **Captura de evidencia:** la salida de `mongorestore`.

## Paso 6. Verificar que todo quedó igual

**Conteos (deben coincidir con los del paso 1):**

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "['propietarios','mascotas','consultas','vacunas'].forEach(c => print(c + ': ' + db[c].countDocuments()))"
```

**La validación `$jsonSchema` y los índices también se restauran:**

```powershell
mongosh "mongodb://localhost:27017/vetllano" -u app_vetllano -p --authenticationDatabase vetllano --eval "print(Object.keys(db.getCollectionInfos({name:'mascotas'})[0].options)); print(db.consultas.getIndexes().map(i => i.name)); print(db.propietarios.getIndexes().map(i => i.name))"
```

Debe aparecer `validator,validationLevel,validationAction` y los índices `mascota_fecha` y `cedula_unica` (estos dos existen si ejecutaste `consultas.js`).

> 📸 **Captura de evidencia:** los conteos DESPUÉS, iguales a los del paso 1, y la verificación de validación e índices.

## Paso 7. Armar la carpeta de entrega

La carpeta del respaldo va dentro del `.zip` final que se sube a Q10. Comprímela por separado para revisarla:

```powershell
Compress-Archive -Path "respaldo\vetllano_$fecha" -DestinationPath "respaldo_vetllano_$fecha.zip"
```

> Las carpetas `respaldo/` y los `.zip` están en `.gitignore`, así que no se suben a GitHub. Solo van en el `.zip` de entrega de la plataforma.

## Alternativa: exportación a JSON (opcional)

Si además quieres archivos legibles (por ejemplo para revisar en un editor), exporta una colección:

```powershell
mongoexport --host localhost --port 27017 --username app_vetllano --authenticationDatabase vetllano --db vetllano --collection mascotas --jsonArray --pretty --out "respaldo\mascotas.json"
```

El respaldo oficial del proyecto es el de `mongodump`; el JSON solo sirve para lectura.

## Notas

- **Qué incluye este respaldo:** solo la base `vetllano`. Los usuarios viven en la base `admin`, por eso no se respaldan aquí. Si quisieras respaldar todo el servidor, tendría que hacerlo `admin_mongo` con `--authenticationDatabase admin`.
- **Mínimo privilegio:** el respaldo y la restauración de `vetllano` se hicieron sin usar al administrador.
- **Buena práctica:** en un sistema real se programa el respaldo (por ejemplo con el Programador de tareas de Windows) y se guarda una copia fuera del equipo.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Authentication failed` | Revisa la contraseña y que `--authenticationDatabase` sea `vetllano`. |
| `not authorized` al respaldar | El usuario no tiene el rol `readWrite` sobre `vetllano`; revisa `crear_usuarios.js`. |
| `mongodump` no se reconoce | Instala MongoDB Database Tools y abre una PowerShell nueva (paso 0). |
| `restore` dice `duplicate key` | Faltó `--drop`: la colección ya tenía datos. |
