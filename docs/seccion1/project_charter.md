# Project Charter - SumaControl

## Datos generales

- Proyecto: SumaControl, Sistema de Gestion Logistica de Recepcion de Proveedores y Desembarque.
- Version documentada: v2.0.1-qa.
- Patrocinador y Product Owner: Lic. Milton Pineda.
- Scrum Master: Andrea Yamilette Aguilera Recinos.
- Equipo de desarrollo: Fatima Esmeralda Calderon Rivas y Otto Alexander Hernandez Arevalo.
- Institucion: Universidad Dr. Jose Matias Delgado, Facultad de Economia, Empresa y Negocios.
- Asignatura: Metodologias de Desarrollo de Software 0, Ciclo 2-2026, Grupo 1-1.

## Problema y justificacion

Las llegadas se registran de forma manual y la asignacion de las cinco bahias depende del criterio del operador. Esto produce congestion, esperas prolongadas, asignaciones incompatibles y falta de trazabilidad.

SumaControl centraliza la programacion de citas, el registro de llegadas, la clasificacion de puntualidad y la asignacion de bahias mediante una cola de prioridad con aging.

## Objetivo general

Poner en operacion un sistema que reduzca la congestion y los tiempos de espera en la recepcion de proveedores, con trazabilidad completa y aplicacion automatica de las reglas de negocio.

## Objetivos medibles

1. Clasificar llegadas con la tolerancia RN-04 de 15 minutos.
2. Asignar las cinco bahias respetando RN-07 y RN-08.
3. Evitar la inanicion mediante prioridad y aging.
4. Registrar eventos y auditoria de forma trazable.
5. Recuperar el servicio con RTO menor a 15 minutos.
6. Proteger el acceso y los datos mediante JWT, RBAC, bcrypt y HTTPS.

## Alcance

Dentro del alcance:

- Registro de proveedores y pedidos.
- Programacion de citas.
- Registro y clasificacion de llegadas.
- Asignacion de gateways y operaciones de descarga.
- Reportes de cumplimiento.
- Administracion de gateways, parametros, usuarios y roles.
- Notificaciones internas.

Fuera del alcance actual:

- Aplicacion movil nativa.
- Integracion con ERP externo.
- MFA integrado a la version de produccion.
- Tablero en tiempo real mediante WebSockets.

## Interesados

- Patrocinador y Product Owner.
- Direccion de Operaciones.
- Coordinador logistico.
- Operadores de garita.
- Administrador del sistema.
- Proveedores.
- Equipo del proyecto y catedratica.

## Criterios de calidad y exito

- 0 incidentes criticos.
- 0 asignaciones incompatibles.
- Al menos 95 % de llegadas registradas sin intervencion manual.
- UAT aprobado al 100 % en los casos criticos.
- Rollback ensayado con RTO menor a 15 minutos.

## Presupuesto

- Inversion inicial: USD 4,176.
- Costo anual de operacion y mantenimiento: USD 1,635.
