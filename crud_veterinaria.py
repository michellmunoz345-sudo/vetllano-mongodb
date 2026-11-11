"""
crud_veterinaria.py - VetLlano (Proyecto #7: Registro de mascotas y servicios veterinarios)

Programa de conexion con CRUD completo (PyMongo) sobre las colecciones
`propietarios` y `mascotas`.

- Se conecta con el USUARIO DE APLICACION (readWrite solo sobre `vetllano`).
- La cadena de conexion se lee del archivo .env (variable MONGO_URI).
  No hay contrasenas en el codigo.
- Usa datos de prueba propios (cedula 1099887766) y los elimina al final,
  por lo que no altera los datos iniciales.

Uso:
    pip install -r requirements.txt
    python crud_veterinaria.py
"""

import os
import sys
from datetime import datetime, timezone
from pprint import pprint

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import (
    DuplicateKeyError,
    OperationFailure,
    ServerSelectionTimeoutError,
    WriteError,
)

# Cedula reservada para los datos de prueba de este programa
CEDULA_PRUEBA = "1099887766"


# ---------------------------------------------------------------------
# Conexion
# ---------------------------------------------------------------------
def conectar():
    """Lee MONGO_URI del .env y devuelve (cliente, base_de_datos)."""
    load_dotenv()  # carga las variables del archivo .env
    uri = os.getenv("MONGO_URI")
    nombre_bd = os.getenv("MONGO_DB", "vetllano")

    if not uri or "CAMBIAR_POR_TU_CONTRASENA" in uri:
        sys.exit("ERROR: define MONGO_URI en el archivo .env (copia .env.example como .env "
                 "y escribe la contrasena del usuario de aplicacion).")

    cliente = MongoClient(uri, serverSelectionTimeoutMS=5000)
    bd = cliente[nombre_bd]

    # connectionStatus obliga a autenticar y muestra con que usuario se entro
    estado = bd.command("connectionStatus")
    usuarios = estado["authInfo"]["authenticatedUsers"]
    print(f"Conectado a la base '{nombre_bd}' como: {[u['user'] for u in usuarios]}")
    return cliente, bd


def titulo(texto):
    print(f"\n{'=' * 60}\n{texto}\n{'=' * 60}")


# ---------------------------------------------------------------------
# C - CREATE (crear)
# ---------------------------------------------------------------------
def crear_propietario(bd, cedula, nombres, apellidos, celular, barrio, calle):
    """Inserta un propietario (direccion y telefonos van embebidos)."""
    documento = {
        "cedula": cedula,
        "nombres": nombres,
        "apellidos": apellidos,
        "telefonos": [{"tipo": "celular", "numero": celular}],
        "direccion": {
            "barrio": barrio,
            "calle": calle,
            "ciudad": "Villavicencio",
            "departamento": "Meta",
        },
        "fecha_registro": datetime.now(timezone.utc),
        "activo": True,
    }
    return bd.propietarios.insert_one(documento).inserted_id


def crear_mascota(bd, propietario_id, nombre, especie, raza, sexo, peso_kg):
    """Inserta una mascota que referencia a su propietario por propietario_id."""
    documento = {
        "propietario_id": propietario_id,           # referencia
        "nombre": nombre,
        "especie": especie,
        "raza": raza,
        "sexo": sexo,
        "fecha_nacimiento": datetime(2025, 3, 10, tzinfo=timezone.utc),
        "peso_kg": peso_kg,
        "esterilizado": False,
        "alergias": [],                              # arreglo embebido
        "condiciones_cronicas": [],
        "activa": True,
    }
    return bd.mascotas.insert_one(documento).inserted_id


# ---------------------------------------------------------------------
# R - READ (leer)
# ---------------------------------------------------------------------
def leer_mascota(bd, mascota_id):
    """Devuelve una mascota por su _id (o None)."""
    return bd.mascotas.find_one({"_id": mascota_id}, {"ultima_consulta": 0})


def listar_mascotas(bd, filtro=None, limite=10):
    """Lista mascotas con proyeccion y orden alfabetico."""
    cursor = (
        bd.mascotas.find(filtro or {}, {"_id": 0, "nombre": 1, "especie": 1, "raza": 1, "peso_kg": 1})
        .sort("nombre", 1)
        .limit(limite)
    )
    return list(cursor)


def mascotas_de_propietario(bd, cedula):
    """Busca el propietario por cedula y devuelve sus mascotas (join manual por referencia)."""
    propietario = bd.propietarios.find_one({"cedula": cedula})
    if propietario is None:
        return []
    return list(bd.mascotas.find({"propietario_id": propietario["_id"]},
                                 {"_id": 0, "nombre": 1, "especie": 1, "raza": 1}))


# ---------------------------------------------------------------------
# U - UPDATE (actualizar)
# ---------------------------------------------------------------------
def actualizar_peso_y_esterilizacion(bd, mascota_id, peso_kg):
    """$set: cambia peso y marca la mascota como esterilizada."""
    return bd.mascotas.update_one(
        {"_id": mascota_id},
        {"$set": {"peso_kg": peso_kg, "esterilizado": True}},
    )


def agregar_alergia(bd, mascota_id, alergia):
    """$push: agrega una alergia al arreglo embebido."""
    return bd.mascotas.update_one({"_id": mascota_id}, {"$push": {"alergias": alergia}})


def quitar_alergia(bd, mascota_id, alergia):
    """$pull: quita una alergia del arreglo embebido."""
    return bd.mascotas.update_one({"_id": mascota_id}, {"$pull": {"alergias": alergia}})


# ---------------------------------------------------------------------
# D - DELETE (eliminar)
# ---------------------------------------------------------------------
def eliminar_mascota(bd, mascota_id):
    return bd.mascotas.delete_one({"_id": mascota_id})


def eliminar_propietario(bd, propietario_id):
    return bd.propietarios.delete_one({"_id": propietario_id})


def limpiar_datos_prueba(bd):
    """Borra restos de ejecuciones anteriores del programa (solo la cedula de prueba)."""
    propietario = bd.propietarios.find_one({"cedula": CEDULA_PRUEBA})
    if propietario:
        bd.mascotas.delete_many({"propietario_id": propietario["_id"]})
        bd.propietarios.delete_one({"_id": propietario["_id"]})


# ---------------------------------------------------------------------
# Demostracion del CRUD completo
# ---------------------------------------------------------------------
def demostrar_crud(bd):
    limpiar_datos_prueba(bd)

    # ---------------- CREATE ----------------
    titulo("C - CREATE: crear propietario y mascota")
    propietario_id = crear_propietario(
        bd, CEDULA_PRUEBA, "Camila Andrea", "Vargas Duarte", "315 700 4521", "Kirpas", "Calle 20 # 35-12"
    )
    print("Propietario creado con _id:", propietario_id)
    mascota_id = crear_mascota(bd, propietario_id, "Canela", "perro", "Criollo", "hembra", 9.5)
    print("Mascota creada con _id:", mascota_id)

    # La validacion $jsonSchema rechaza datos invalidos (peso negativo y especie no permitida)
    print("\nIntento de insertar una mascota INVALIDA (peso negativo, especie 'dragon'):")
    try:
        crear_mascota(bd, propietario_id, "Draco", "dragon", "Mitico", "macho", -5)
        print("ERROR: se acepto un documento invalido")
    except WriteError as e:
        print(f"  Rechazada por la validacion (codigo {e.code}): {e.details.get('errmsg')}")

    # Si existe el indice unico de cedula (consultas.js), una cedula repetida tambien se rechaza
    try:
        crear_propietario(bd, CEDULA_PRUEBA, "Duplicado", "De Prueba", "300 000 0000", "Centro", "Calle 1 # 1-1")
        print("Aviso: el indice unico de cedula no esta creado (ejecuta consultas.js), se acepto el duplicado.")
        bd.propietarios.delete_many({"cedula": CEDULA_PRUEBA, "nombres": "Duplicado"})
    except DuplicateKeyError:
        print("  Cedula duplicada rechazada por el indice unico (codigo 11000).")

    # ---------------- READ ----------------
    titulo("R - READ: leer documentos")
    print("Mascota por _id:")
    pprint(leer_mascota(bd, mascota_id))

    print("\nPerros de mas de 20 kg (filtro con $gt, primeros 5):")
    pprint(listar_mascotas(bd, {"especie": "perro", "peso_kg": {"$gt": 20}}, limite=5))

    print("\nMascotas del propietario con cedula de prueba:")
    pprint(mascotas_de_propietario(bd, CEDULA_PRUEBA))

    print("\nTotal de mascotas en la coleccion:", bd.mascotas.count_documents({}))

    # ---------------- UPDATE ----------------
    titulo("U - UPDATE: actualizar documentos")
    r = actualizar_peso_y_esterilizacion(bd, mascota_id, 10.2)
    print(f"$set  -> coincidencias: {r.matched_count}, modificados: {r.modified_count}")
    r = agregar_alergia(bd, mascota_id, "penicilina")
    print(f"$push -> modificados: {r.modified_count}")
    r = agregar_alergia(bd, mascota_id, "pollo")
    print(f"$push -> modificados: {r.modified_count}")
    r = quitar_alergia(bd, mascota_id, "pollo")
    print(f"$pull -> modificados: {r.modified_count}")
    print("\nMascota despues de las actualizaciones:")
    pprint(bd.mascotas.find_one({"_id": mascota_id}, {"_id": 0, "nombre": 1, "peso_kg": 1,
                                                       "esterilizado": 1, "alergias": 1}))

    # ---------------- DELETE ----------------
    titulo("D - DELETE: eliminar documentos")
    r = eliminar_mascota(bd, mascota_id)
    print("Mascota eliminada:", r.deleted_count)
    r = eliminar_propietario(bd, propietario_id)
    print("Propietario eliminado:", r.deleted_count)
    print("Verificacion -> mascota existe:", leer_mascota(bd, mascota_id) is not None,
          "| propietario existe:", bd.propietarios.count_documents({"cedula": CEDULA_PRUEBA}) > 0)


def main():
    try:
        cliente, bd = conectar()
    except ServerSelectionTimeoutError:
        sys.exit("ERROR: no se pudo conectar con MongoDB. Verifica que el servicio este iniciado "
                 "(Get-Service MongoDB) y que host y puerto del .env sean correctos.")
    except OperationFailure as e:
        sys.exit(f"ERROR de autenticacion o permisos (codigo {e.code}). Revisa usuario, contrasena "
                 "y authSource en MONGO_URI del .env.")

    try:
        demostrar_crud(bd)
    except OperationFailure as e:
        sys.exit(f"ERROR de permisos o de la operacion (codigo {e.code}): {e}")
    finally:
        cliente.close()
    print("\nCRUD completado correctamente.")


if __name__ == "__main__":
    main()
