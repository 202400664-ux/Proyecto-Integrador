# Sistema de Gestión de Red de Proveedores (MVP)
> Proyecto Integrador - Fase II: Diseño

## Equipo Scrum
* **Scrum Master:** Andrea Yamilette Aguilera Recinos
* **Development Team:** 
  * Fatima Esmeralda Calderon Rivas
  * Otto Alexander Hernandez Arevalo

## Asignaturas Integradas
* Metodologías de Desarrollo de Software 0 (MDS 0)
* Estructuras de Datos (EDA 0)
* Redes / Sistemas Operativos (GRE 1 / GSO 0)
* Desarrollo Web Nube (PON 0)

## Gestión de Gateways y Descargas

El módulo usa MongoDB como replica set para que iniciar/finalizar una descarga actualice de forma atómica el pedido, el gateway y la colección `descargas`. En desarrollo, configura MongoDB con replica set y define `MONGO_URI`, por ejemplo `mongodb://localhost:27017/sprint0auth?replicaSet=rs0`.

Antes de iniciar el backend, ejecuta `npm run seed` desde `backend/`. El seed crea el parámetro `numero_equipo` (valor inicial `04`) y los cinco gateways con su tipo de carga fijo. Después inicia el servidor con `npm run dev` desde `backend/` y el frontend con `npm run dev` desde `frontend/`.

Los pedidos nuevos reciben el número `PED-EQUI[numero_equipo]-[correlativo_9_digitos]` desde el backend; el formulario no solicita ese identificador.
