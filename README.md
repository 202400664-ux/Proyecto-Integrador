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

## Ejecución local

1. Configura `MONGO_URI` y `JWT_SECRET` en `backend/.env`.
2. Ejecuta `npm install` y luego `npm run seed` desde `backend/`. El seed agrega el parámetro `numero_equipo` (por defecto `04`) y los horarios operativos.
3. Ejecuta `npm run dev` desde `backend/` y, en otra terminal, `npm install` y `npm run dev` desde `frontend/`.

El servidor MongoDB puede usar replica set para transacciones. Si no está disponible, las operaciones de descarga incluyen compensación ante fallos parciales; el modo de prueba de integración se configura por separado con `MONGO_TEST_URI` apuntando exclusivamente a una base de pruebas.
