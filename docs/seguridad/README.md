# Evidencia de controles de seguridad - SumaControl

## Entregables

- [Informe de riesgos, controles y factibilidad](../Analisis_Riesgos_Controles_Seguridad_Factibilidad_SumaControl.docx)
- [Esquema MongoDB y validadores](../schema_mongodb.js)
- [Diagrama de despliegue](../diagrama_despliegue_uml.png)
- [Diagrama de componentes](../diagrama_componentes_uml.png)

## Evidencia técnica del repositorio

| Control | Evidencia |
|---|---|
| JWT y autenticación | [backend/src/middleware/autenticar.ts](../../backend/src/middleware/autenticar.ts) |
| RBAC y permisos | [backend/src/services/permisos.ts](../../backend/src/services/permisos.ts) |
| Hash de contraseñas | [backend/src/models/Usuario.ts](../../backend/src/models/Usuario.ts) |
| MFA | [backend/src/controllers/mfaController.ts](../../backend/src/controllers/mfaController.ts) |
| Gestión de roles | [backend/src/routes/roles.ts](../../backend/src/routes/roles.ts) |
| Gestión de usuarios | [backend/src/routes/usuariosRoutes.ts](../../backend/src/routes/usuariosRoutes.ts) |

## Pendientes declarados

La implementación completa de HTTPS/TLS, CORS restringido, Helmet, sanitización NoSQL y rate limiting debe verificarse en el entorno de despliegue antes del go-live. La evidencia del informe distingue los controles implementados de los controles definidos o propuestos.
