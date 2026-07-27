# Plan de actualización de dependencias y migración de OpenAI

Fecha del relevamiento: 20 de julio de 2026.
Última actualización de progreso: 27 de julio de 2026.

Este documento vivo propone cómo actualizar todas las dependencias declaradas en `package.json`, registra el progreso y planifica la migración de las dos integraciones de OpenAI a Responses API. Las versiones objetivo fueron consultadas en npm Registry en la fecha indicada. Antes de ejecutar el plan se deben volver a consultar, leer changelogs y regenerar `package-lock.json`; no se deben copiar versiones futuras de este documento a ciegas.

## Objetivos

- Eliminar vulnerabilidades conocidas del lockfile.
- Estandarizar explícitamente Node.js 26.5.0 en desarrollo, CI y producción.
- Actualizar cada dependencia directa y cada dependencia de desarrollo.
- Migrar Express 4 a Express 5, Zod 3 a Zod 4 y TypeScript de forma escalonada.
- Reemplazar Chat Completions y Assistants/Threads por Responses API.
- Mantener cambios pequeños, reversibles y medidos con tests/evals.

## Principios de ejecución

1. No mezclar todas las actualizaciones en un solo commit.
2. Crear tests de caracterización antes de cambiar versiones mayores.
3. Ejecutar instalación limpia y auditoría después de cada grupo.
4. Separar actualización de SDK, migración de API y cambio de modelo OpenAI.
5. Mantener el modelo y prompt actuales como baseline hasta comparar calidad, costo y latencia.
6. Promover cada fase a staging antes de continuar con la siguiente.
7. Conservar el lockfile anterior como vía de rollback en cada etapa.

## Estado de avance

Se usa la misma leyenda que en `CAMBIOS_Y_MEJORAS.md`: ✅ verificado, 🟡 ejecutado pendiente de verificar, 🔵 decidido, ⬜ pendiente y ⛔ bloqueado.

| Área | Estado | Evidencia | Falta para completarla |
|---|---|---|---|
| Inventario de las 18 dependencias | ✅ Verificado | Versiones actuales y objetivos relevados desde `package-lock.json` y npm Registry. | Reconsultar versiones justo antes de cada PR. |
| Auditoría de seguridad inicial | ✅ Verificado | Baseline: 1 vulnerabilidad crítica, 5 altas y 2 moderadas en dependencias de producción. | Repetir después de cada fase y justificar cualquier excepción. |
| Auditoría de seguridad actual | ✅ Verificado | `npm audit --omit=dev` devuelve cero vulnerabilidades después de OpenAI, parches y Express 5. | Mantener el gate después de cada grupo. |
| Node.js 26.5.0 como objetivo | ✅ Verificado en checkout y configurado en CI | `.nvmrc`, `engines`, `packageManager`, `@types/node` 26.1.1 y el workflow usan 26.5.0 exacto. | Replicar la versión exacta en despliegue y observar la primera ejecución alojada. |
| Runtime efectivo del checkout | 🟡 Parcial | Todos los gates y el smoke test se ejecutaron con Node 26.5.0/npm 11.17.0 desde el ZIP oficial verificado. El Node global inspeccionado sigue en 22.17.0 porque no hay `nvm` instalado. | Instalar/seleccionar 26.5.0 como runtime global del equipo o usar un gestor compatible. |
| Cambios de esquema Turso requeridos por OpenAI | ✅ Verificado | Las 14 columnas faltantes fueron aplicadas y verificadas por MCP el 2026-07-27. | Integrarlas en repositorios y servicios. |
| Esquema remoto de `users` | ✅ Verificado | Las 12 columnas están presentes y la auditoría no encontró nombres vacíos ni experiencia nula. | Endurecer validaciones desde el código sin reconstruir la tabla. |
| Esquema remoto del resto de tablas | ✅ Verificado | Las ocho tablas de negocio y sus columnas finales fueron verificadas por MCP. | Consumir el esquema final desde repositorios y servicios. |
| Integridad referencial de datos existentes | ✅ Verificado | `foreign_key_check` no devolvió filas y `foreign_key_list` confirmó ocho relaciones declaradas. | Se decidió conservar `NO ACTION` y resolver borrados relacionados explícitamente. |
| Índices y seed remoto | ✅ Verificado | Ocho índices explícitos, unicidades y cinco categorías están versionados en `0001`. | Mantener el gate en CI mediante el runner. |
| Tabla `schema_migrations` | ✅ Verificado localmente y en staging | `local.db` y `buildear-db-staging` contienen `0001`–`0004` con checksums válidos; staging tiene 10 tablas, 10 índices e integridad OK. | Ejecutar pruebas funcionales de staging antes de promover a producción. |
| Sincronización de `local.db` | ✅ Verificado | Fue actualizada hasta `0004`, pasa integridad/FKs y cada conexión `file:` activa `PRAGMA foreign_keys = ON`. | Mantener el gate al avanzar dependencias. |
| Actualización de paquetes | 🟡 En curso | Se actualizaron libSQL, OpenAI, Zod, Express, Cloudinary, CORS, fileupload, dotenv, tsx y tipos; Passport fue retirado. | Continuar TypeScript y configuración centralizada. |
| OpenAI SDK 6 | ✅ Verificado localmente y contra el proveedor | `openai` 6.49.0 con proveedor inyectable, tests sin red y smoke real exitoso con metadata de uso. | Mantener el smoke fuera de CI y ejecutar canary con presupuesto acotado. |
| Responses para chat | 🟡 Proveedor y telemetría E2E verificados | Registro, login y `POST /api/v1/openai/message` completaron el flujo real; `ai_generations` contiene metadata, pero no se creó conversación ni se guardaron mensajes. | Persistir mensajes y metadata del asistente; luego ejecutar evals/canary. |
| Responses para guías | 🟡 Proveedor y telemetría E2E verificados | `POST /api/v1/openai` completó Structured Outputs y persistió telemetría en `ai_generations`, pero no guardó el JSON en `user_models`. | Definir `model_id`/recurso de guía, persistir contenido y comparar modelos. |
| Selección de modelos | 🟡 Comparación inicial ejecutada | Los mismos smokes reales pasaron con `gpt-4o-mini` y `gpt-5.4-mini`; el segundo fue más lento y entre 7,18 y 14,97 veces más costoso en estas muestras. | Crear dataset y graders para comparar calidad y seguridad antes de elegir. |
| Express 5, Zod 4 y TypeScript | 🟡 En curso | Express 5.2.1, Zod 4.4.3 y TypeScript 6.0.3 pasan la suite. | Esperar soporte de TypeScript 7 en typescript-eslint. |
| Seguridad y caracterización HTTP | ✅ Baseline verificado | Sesiones opacas, DTO público, ownership, roles, scrypt/rehash, límites y seis tests verdes. El ADR decide no usar refresh inicialmente. | Adoptar store compartido de rate limiting al escalar y replicar gates en CI. |
| CI y operación HTTP | 🟡 Configurado localmente | Workflow sin secretos, `/api/v1`, headers defensivos, health/readiness y shutdown pasan tests/build. | Publicar el workflow y verificar su primera ejecución en GitHub Actions. |

### Registro de decisiones y supuestos

| ID | Decisión o supuesto | Estado | Impacto |
|---|---|---|---|
| DEC-001 | Usar Node.js 26.5.0 en desarrollo, CI y producción | Aprobada | `@types/node`, `engines`, imágenes y toolchain deben alinearse. |
| DEC-002 | Mantener Turso/libSQL en vez de cambiar de motor | Propuesta vigente | El trabajo se concentra en migraciones y consistencia, no en replatforming. |
| DEC-003 | Usar Turso como fuente de verdad del chat y Responses con `store: false` inicialmente | Propuesta pendiente de aprobación | Evita depender del estado remoto de OpenAI y reutiliza las tablas existentes. |
| DEC-004 | No incorporar Agents SDK mientras no existan herramientas autónomas | Propuesta pendiente de aprobación | Reduce orquestación y superficie de fallo. |
| DEC-005 | Separar actualización de API y selección de modelo | Aprobada por el plan | Permite medir regresiones y volver atrás con menor riesgo. |

## Plataforma objetivo

### Node.js

El equipo local relevado usa Node `22.17.0`, pero la decisión del proyecto es estandarizar desarrollo, CI y despliegue en Node `26.5.0`. En la fecha de este documento Node 26 figura como Current y no como LTS; esta condición debe quedar aceptada explícitamente y revisarse en cada actualización de seguridad.

Acciones:

- Agregar `.nvmrc`, `.node-version` o la configuración equivalente con el valor exacto `26.5.0`.
- Declarar en `package.json`:

```json
{
    "engines": {
        "node": ">=26.5.0 <27",
        "npm": ">=10"
    }
}
```

- Usar `@types/node` 26.x para que los tipos representen la major del runtime real.
- Ejecutar la CI y los artefactos de despliegue con Node `26.5.0`; cualquier matriz temporal con Node 22 debe ser sólo informativa y no bloquear la adopción del runtime objetivo.

Fuente: [ciclo de releases de Node.js](https://nodejs.org/en/about/previous-releases).

## Matriz completa de dependencias de producción

| Paquete | Resuelto actual | Último consultado | Objetivo | Riesgo | Acción principal |
|---|---:|---:|---:|---|---|
| `@libsql/client` | 0.17.4 | 0.17.4 | 0.17.4 | Medio | ✅ Actualizado e importado desde `@libsql/client`; runner y tests `file:` verdes. |
| `@types/express-fileupload` | 1.5.1 | 1.5.1 | 1.5.1 | Bajo | ✅ En `devDependencies`. |
| `cloudinary` | 2.10.0 | 2.10.0 | 2.10.0 | Alto/seguridad | 🟡 Actualizado; lifecycle de modelos verificado con doble local, faltan perfiles y staging. |
| `cors` | 2.8.6 | 2.8.6 | 2.8.6 | Bajo | ✅ Actualizado y configurado con allowlist. |
| `dotenv` | 17.4.2 | 17.4.2 | 17.4.2 | Medio | ✅ Actualizado; falta schema central de configuración. |
| `express` | 5.2.1 | 5.2.1 | 5.2.1 | Alto/major | ✅ Migrado con tests HTTP y error middleware. |
| `express-fileupload` | 1.5.2 | 1.5.2 | 1.5.2 | Bajo | ✅ Actualizado con límites, temporales portables y validación real de modelos/imágenes multipart. |
| `openai` | 6.49.0 | 6.49.0 | 6.49.0 | Alto/major | ✅ Responses API y mocks verificados localmente. |
| `zod` | 4.4.3 | 4.4.3 | 4.4.3 | Alto/major | ✅ Structured Outputs y validaciones verdes. |

## Matriz completa de dependencias de desarrollo

| Paquete | Resuelto actual | Último consultado | Objetivo | Riesgo | Acción principal |
|---|---:|---:|---:|---|---|
| `@types/cors` | 2.8.19 | 2.8.19 | 2.8.19 | Bajo | ✅ Actualizado y typecheck verde. |
| `@types/express` | 5.0.6 | 5.0.6 | 5.0.6 | Alto/major | ✅ Actualizado junto con Express 5. |
| `@types/express-session` | Retirado | — | Retirar | Medio | ✅ No se usan sesiones de Express. |
| `@types/node` | 26.1.1 | 26.1.1 | 26.1.1 | Medio | ✅ Alineado con Node 26.5.0. |
| `@types/passport` | Retirado | — | Retirar | Bajo | ✅ OAuth fue retirado. |
| `@types/passport-google-oauth20` | Retirado | — | Retirar | Bajo | ✅ OAuth fue retirado. |
| `tsx` | 4.23.1 | 4.23.1 | 4.23.1 | Bajo | ✅ Actualizado; tests TypeScript y CLI de migraciones pasan en Node 26. |
| `typescript` | 6.0.3 | 7.0.2 | 7.0.2 por etapas | Alto/major | ✅ TS6 verde; TS7 bloqueado por peer `<6.1.0` de typescript-eslint 8.65.0. |

## Dependencias ausentes o mal ubicadas

### Mover a desarrollo

`@types/express-fileupload` no es necesario en runtime. Debe moverse a `devDependencies`.

### Resolver la inconsistencia de sesiones

El proyecto declara `@types/express-session`, pero no declara `express-session`. Se debe tomar una decisión:

- Si AUTH-002 usa sesiones, agregar `express-session`, un store persistente compatible y configuración segura de cookies.
- Si usa tokens o Passport sin sesión, retirar `@types/express-session` y configurar `session: false` explícitamente.

### Resolver Google OAuth

El proyecto declara tipos de `passport-google-oauth20`, pero no el paquete de runtime. Si OAuth continúa, agregar `passport-google-oauth20` con una versión verificada al momento de implementación. Si no continúa, retirar Passport, sus tipos y rutas.

### Tooling incorporado

La configuración Standard/ESLint legacy fue reemplazada por flat config ESM y
scripts reproducibles. Se agregaron:

- `eslint` 10.8.0;
- `@eslint/js` 10.0.1;
- `typescript-eslint` 8.65.0;
- `eslint-config-prettier` 10.1.8;
- `prettier` 3.9.6.

El gate actual es verde. Las reglas de `no-explicit-any` y variables sin uso
permanecen desactivadas temporalmente para caracterizar el código legacy y
deben endurecerse después de los fixes P0.

## Plan de implementación de dependencias y OpenAI

### Tablero de ejecución

| Paquete de trabajo | Estado | Depende de | Resultado | Validación obligatoria |
|---|---|---|---|---|
| DEP-00 — Verificar Turso y baseline | 🟡 En curso | Acceso de lectura | Esquema confirmado, migraciones y baseline reproducible | PRAGMA, migraciones, audit y caracterización local registrados; falta CI/staging |
| DEP-01 — Aplicar Node 26.5.0 | 🟡 Verificado localmente | DEP-00 | Runtime único en local/CI/producción | Archivos, instalación, gates y smoke test verdes; faltan CI/despliegue |
| DEP-02 — Parches de seguridad | 🟡 Verificado localmente | DEP-01 | Cloudinary, CORS, fileupload, dotenv y tipos actualizados | Audit cero y CORS verde; falta test multipart/lifecycle |
| DEP-03 — libSQL y migraciones | 🟡 Verificado localmente | DEP-00/01 | Cliente compatible con `file:` y Turso | Suite `file:` verde; falta Turso staging sin DDL |
| DEP-04 — Express 5 | ✅ Verificado localmente | Baseline verde | Express 5.2.1/tipos 5.0.6 y error middleware | Suite HTTP, typecheck, build y audit verdes |
| DEP-05 — OpenAI SDK 6 y Zod 4 | 🟡 Verificado localmente | DEP-00/01 y mocks | OpenAI 6.49.0, Zod 4.4.3 y adaptador Responses | Typecheck/mocks verdes; falta staging |
| DEP-06 — Migrar guías | 🟡 Implementación local verificada | DEP-05 | `responses.parse`, metadata y validación estricta | Structured Outputs simulados verdes; faltan evals/canary |
| DEP-07 — Migrar chat | 🟡 Implementación local verificada | DEP-05 y decisión DEC-003 | `responses.create`, un turno y telemetría | Tests multiusuario verdes; faltan contexto/evals/canary |
| DEP-08 — TypeScript 6 → 7 | 🟡 TS6 verificado | DEP-02/04/05 | TypeScript 6.0.3 verde | TS7 espera compatibilidad de typescript-eslint |
| DEP-09 — Passport, sesiones y tooling | ✅ Verificado localmente | Decisión AUTH-002 | Sesiones opacas, roles y rate limiting; Passport/tipos retirados | Falta store compartido al escalar |
| DEP-10 — Rollout y automatización | ⬜ Pendiente | DEP-02–09 | Canary, rollback y actualizaciones automáticas | Métricas y simulación de rollback |

### Flujo obligatorio para cada paquete de trabajo

1. Crear un PR dedicado y registrar versión inicial/objetivo.
2. Leer changelog y breaking changes de todos los paquetes del PR.
3. Actualizar tests antes o junto al cambio; nunca después del rollout.
4. Regenerar lockfile mediante instalación limpia.
5. Ejecutar format, lint, typecheck, tests, build y audit.
6. Probar integración afectada en staging.
7. Actualizar las tablas de progreso de ambos Markdown con evidencia.
8. Promover, observar y cerrar sólo después del gate; ante regresión, revertir el PR completo.

## Fase 0 — Baseline reproducible

Antes de cambiar dependencias:

- [ ] Crear una rama `codex/dependency-modernization` o equivalente.
- [x] Registrar el runtime actual y el inventario de dependencias.
- [x] Ejecutar `npm audit --omit=dev` y registrar el baseline.
- [x] Verificar `PRAGMA table_info('users')` mediante el export de Drizzle.
- [x] Verificar `table_list` y `table_info` de las ocho tablas de negocio.
- [x] Ejecutar `foreign_key_check`: no se detectaron filas huérfanas.
- [x] Ejecutar `foreign_key_list` e `index_list`: ocho FKs y ocho índices explícitos confirmados mediante MCP.
- [x] Completar metadata faltante en `models`, `user_models`, `conversations` y `conversation_messages`.
- [x] Crear `schema_migrations` y registrar `0001`/`0002` con checksums.
- [x] Auditar datos legacy de `users`: los datos remotos no contienen nombres vacíos ni experiencia nula.
- [x] Auditar dimensiones/posición de `models` y pasos de `user_models`: no se encontraron valores inválidos.
- [x] Convertir el SQL manual en migraciones y regenerar `local.db`.
- [x] Agregar tests de caracterización para endpoints, queries y respuestas OpenAI simuladas.
- [x] Crear scripts reproducibles de formato, lint, typecheck, test, build, start y migraciones.
- [ ] Crear un tag o commit de rollback antes de la primera actualización.

Gate de salida:

- Instalación limpia reproducible.
- Baseline verde o lista explícita de fallos preexistentes.
- Ninguna prueba depende de credenciales reales de Cloudinary/OpenAI/Turso.

Evidencia local del 2026-07-27:

- `npm ci` ejecutado con Node `v26.5.0` y npm `11.17.0`;
- `format:check`, `lint`, `typecheck`, dos tests y `build` verdes en el primer
  corte;
- smoke test del artefacto compilado: `GET /` devolvió `200`;
- `.env.example` documenta el fallback local y no contiene credenciales;
- ninguna prueba automatizada utilizó credenciales ni proveedores remotos;
- el segundo corte agregó tests HTTP de autenticación/ownership/modelos y un
  cliente OpenAI totalmente simulado. `npm test` pasa seis tests;
- se repitieron `npm ci`, formato, lint, typecheck, build, smoke test de
  `dist/` y verificación de migraciones con Node 26.5.0/npm 11.17.0;
- luego de DEP-02/DEP-04, `npm audit --omit=dev` devuelve cero
  vulnerabilidades;
- falta replicar los gates en CI para cerrar la fase.

## Fase 1 — Node 26.5.0 y actualizaciones de bajo riesgo

Actualizar primero paquetes patch/minor que reducen riesgo de seguridad sin requerir todavía cambios mayores:

```powershell
npm install cloudinary@2.10.0
npm install cors@2.8.6
npm install express-fileupload@1.5.2
npm install passport@0.7.0
npm install -D @types/cors@2.8.19
npm install -D @types/passport@1.0.17
npm install -D @types/passport-google-oauth20@2.0.17
npm install -D tsx@4.23.1
```

Mover el paquete de tipos:

```powershell
npm uninstall @types/express-fileupload
npm install -D @types/express-fileupload@1.5.1
```

Validaciones:

- Smoke test de upload de imagen y de recurso 3D.
- Confirmar que los errores Cloudinary no contienen secretos.
- Probar tamaño máximo, temporales y archivos inválidos.
- Ejecutar `npm audit --omit=dev` y verificar que desaparezca la vulnerabilidad directa de Cloudinary.

Cloudinary recomienda actualizar a una versión reciente por mejoras de validación y seguridad: [documentación del SDK Node](https://cloudinary.com/documentation/node_integration).

## Fase 2 — libSQL/Turso y migraciones

```powershell
npm install @libsql/client@0.17.4
```

Cambiar:

```ts
import { createClient } from '@libsql/client/web'
```

por:

```ts
import { createClient } from '@libsql/client'
```

La variante `/web` no soporta URLs locales `file:`. La importación raíz permite usar el fallback SQLite actual: [referencia TypeScript de Turso](https://docs.turso.tech/sdk/ts/reference).

Trabajo asociado:

- ✅ Runner implementado antes de probar el cliente actualizado.
- Probar por separado `file:local.db` y una base Turso de staging.
- Verificar `batch`, transacciones, `RETURNING`, tipos de valores y errores.
- ✅ Claves foráneas activadas por conexión e `integrity_check` ejecutado en local.

Gate de salida:

- La misma suite de integración pasa en SQLite local y Turso staging.
- Una base vacía se crea exclusivamente mediante migraciones.

Resultado local del 2026-07-27:

- `@libsql/client` 0.17.4 se importa desde la raíz y soporta el fallback
  `file:local.db`;
- el runner transaccional descubre `migrations/*.sql`, valida SHA-256,
  registra sólo después del commit y rechaza archivos aplicados modificados;
- los modelos ya no contienen `CREATE TABLE` ni DDL;
- dos tests sobre archivos `file:` temporales verifican base vacía,
  idempotencia, rollback, diez tablas, diez índices, cinco categorías, 14
  columnas de metadata, sesiones, roles, hashes versionados, FKs e integridad;
- `db:migrate` aplicó `0003_auth_sessions.sql` únicamente a `local.db` y
  posteriormente `0004_auth_hardening.sql`; `db:migrate:verify` confirmó cuatro
  migraciones sin pendientes;
- se creó `buildear-db-staging` como branch de producción y se verificaron por
  lectura `0001`/`0002`, 9 tablas, 8 índices y 5 categorías;
- `db:migrate:staging` aplicó `0003`/`0004` mediante el runner y
  `db:migrate:staging:verify` confirmó cuatro checksums e integridad OK;
- una lectura independiente verificó 10 tablas, 10 índices, las columnas de
  rol/hash, `integrity_check = ok` y cero violaciones FK;
- no se usó DDL manual y producción permaneció intacta;
- el runner local confirmó cuatro migraciones e integridad OK; el smoke HTTP
  validó inicio, live, readiness y autenticación requerida;
- `.env.staging` está ignorado y los scripts dedicados cargan su URL/token sin
  alterar la configuración local ni exponer credenciales.

Resultado de seguridad local del 2026-07-27:

- `users.role` reemplaza la allowlist de IDs y se obtiene desde la base en cada
  request autenticado;
- las contraseñas nuevas usan scrypt asíncrono con parámetros versionados;
- PBKDF2 SHA-512/10.000 sigue siendo verificable y se rehashea en el próximo
  login correcto;
- el ADR `docs/adr/0001-authentication-and-authorization.md` registra la
  decisión y sus pendientes;
- no se emiten refresh tokens; el vencimiento exige un nuevo login;
- `express-rate-limit` 8.6.1 protege login, registro, contraseña y OpenAI. Su
  store en memoria debe reemplazarse antes de múltiples instancias;
- los tests HTTP cubren rol común/admin, rehash y `429` sin exponer
  credenciales.

## Fase 3 — Express 5 y tipos

```powershell
npm install express@5.2.1
npm install -D @types/express@5.0.6
```

Express 5 requiere Node 18 o superior y contiene cambios de compatibilidad. El runtime objetivo Node 26.5.0 satisface ese requisito. Seguir la [guía oficial de migración a Express 5](https://expressjs.com/en/guide/migrating-5/).

Cambios a revisar en este repositorio:

- Agregar un middleware central de errores.
- Aprovechar que los handlers async reenvían promesas rechazadas al error handler.
- Verificar que `req.body` pueda ser `undefined`.
- Revisar tipos de `Request`, params y `req.user`.
- Verificar sintaxis de rutas y comportamiento del 404.
- Probar `express.urlencoded`, uploads y CORS.
- Reemplazar los estados `201` incorrectos en lecturas/updates.

La aplicación no usa actualmente patrones complejos de wildcard, por lo que el cambio de sintaxis de rutas debería tener impacto bajo, pero debe quedar cubierto por tests de routing.

Gate de salida:

- Todos los endpoints pasan contract tests.
- Toda promesa rechazada produce una respuesta controlada, sin proceso inestable.
- No hay errores TypeScript de Express 5.

Resultado local del 2026-07-27:

- Express 5.2.1 y `@types/express` 5.0.6 instalados;
- ajustes de tipos de params aplicados;
- routing, CORS, errores async, rate limits y contratos HTTP pasan;
- build y smoke test del artefacto pasan;
- `npm ci`, formato, lint, typecheck, seis tests y migraciones pasan con Node
  26.5.0/npm 11.17.0;
- `npm audit --omit=dev` devuelve cero vulnerabilidades.

## Fase 4 — OpenAI SDK 6, Zod 4 y Responses API

Estas actualizaciones se agrupan porque Structured Outputs reutilizará los schemas Zod.

```powershell
npm install openai@6.49.0
npm install zod@4.4.3
```

No cambiar inmediatamente el modelo además del SDK y la API. Primero se debe conservar un baseline y luego seleccionar el modelo con evals.

### Estado anterior

Hay dos flujos distintos:

| Flujo | Implementación actual | Problema |
|---|---|---|
| Generación de guía | `beta.threads`, mensaje con rol `assistant`, `runs.createAndPoll`, Assistant ID y `JSON.parse` | Assistants está deprecado y tiene cierre anunciado para el 26/08/2026; el JSON no está garantizado ni validado. |
| Chat de asistencia | `chat.completions.create` con `gpt-4o-mini` | Debe migrarse a `responses.create`; no valida entrada, no conserva conversación y no controla abuso. |

OpenAI recomienda Responses para proyectos nuevos y para migraciones graduales. Chat Completions continúa soportado, pero Responses es la dirección futura: [guía oficial de migración](https://developers.openai.com/api/docs/guides/migrate-to-responses). La [guía de migración de Assistants](https://developers.openai.com/api/docs/assistants/migration) anuncia el cierre de Assistants para el 26 de agosto de 2026.

### Variables de entorno objetivo

Normalizar los nombres:

```dotenv
OPENAI_API_KEY=
OPENAI_PROJECT_ID=
OPENAI_ORGANIZATION_ID=
OPENAI_GUIDE_MODEL=
OPENAI_CHAT_MODEL=
```

`store: false` queda fijado en código durante esta etapa y no puede habilitarse
accidentalmente mediante una variable de entorno.

Acciones:

- ✅ Se eliminó `OPEN_AI_ASSITANT_ID` y toda referencia a Assistants.
- ✅ Se normalizaron las variables a `OPENAI_*`.
- Validar todas las variables al inicio.
- Mantener organización/proyecto sólo si realmente son necesarios.
- Separar proyectos y límites de gasto para staging y producción.

### Resultado local del 2026-07-27

- `openai` 6.49.0 y Zod 4.4.3 instalados con lockfile reproducible;
- proveedor Responses inyectable en `services/openAI.ts`;
- guía en `responses.parse` con `zodTextFormat` y validación posterior;
- chat en `responses.create` con `conversation_id` opcional, ownership y
  contexto local de hasta 12 mensajes/12.000 caracteres;
- `store: false` fijado en ambos flujos;
- prompts versionados y entradas de guía tratadas como datos para reducir
  prompt injection;
- éxito, tokens, latencia, modelo, response ID, estado y errores persistidos en
  `ai_generations`;
- incomplete outputs, refusals y errores de proveedor normalizados;
- seis tests sin red ni credenciales, incluyendo integración HTTP y metadata;
- el prompt de chat quedó versionado como
  `chat-responses-v2-context-window` y los tests cubren roles, límites,
  deduplicación del mensaje actual y acceso cruzado;
- el smoke real del 2026-07-27 completó `responses.create` y
  `responses.parse` con `gpt-4o-mini-2024-07-18`, `store: false`, response IDs,
  tokens, latencia, estado `completed` y una guía válida según el schema;
- chat registró 57 tokens de entrada, 7 de salida y 1.695 ms; guía registró
  271 tokens de entrada, 512 de salida y 6.653 ms;
- después del smoke pasaron seis tests, typecheck, build, cuatro migraciones y
  audit sin vulnerabilidades;
- los smokes llamaron directamente a `ResponsesOpenAIService`, por lo que no
  recorrieron `OpenAIModel`/`AiGenerationModel.record` ni escribieron metadata;
- una lectura posterior confirmó cero filas en `ai_generations` tanto en
  `buildear-db-staging` como en `buildear-db`;
- luego se ejecutó el E2E faltante con Node 26.5.0 y la API apuntando sólo a
  `buildear-db-staging`: registro `201`, login `200`, chat `200` y guía `200`;
- Turso confirmó dos filas del usuario sintético ID 30. Chat registró
  `gpt-5.4-mini-2026-03-17`, response ID, prompt
  `chat-responses-v2-context-window`, 56/10 tokens, 1.450 ms y `completed`;
  guía registró el mismo snapshot, response ID, prompt `guide-responses-v1`,
  269/1.312 tokens, 10.645 ms y `completed`;
- la sesión sintética fue revocada, el servidor detenido y producción quedó
  verificada con cero filas de IA y sin el usuario de prueba;
- una verificación funcional posterior confirmó cero conversaciones, cero
  mensajes y cero `user_models` para ese usuario. Los endpoints actuales
  persisten telemetría, no el contenido de chat ni la guía;
- la comparación con el padre de `719b876` confirmó que los endpoints OpenAI
  anteriores tampoco escribían esas tablas: el cliente debía coordinar
  llamadas adicionales a `POST /userModels`, `conversations` y
  `conversationMessages`;
- los métodos de escritura y el esquema permanecen disponibles. La regresión
  está en la integración/contrato del flujo modernizado, que no reemplazó esa
  coordinación al probar los nuevos endpoints OpenAI; no requiere una nueva
  migración SQL;
- formato, lint, typecheck, build, seis tests, migraciones local/staging y audit
  sin vulnerabilidades volvieron a pasar después del E2E;
- faltan evals, separar el proyecto OpenAI de staging y realizar el canary.

### Comparación real inicial de modelos — 2026-07-27

- Se repitieron el mismo chat breve y la misma guía estructurada con
  `gpt-5.4-mini`; el proveedor devolvió el snapshot
  `gpt-5.4-mini-2026-03-17`.
- Chat: estado `completed`, response ID presente, 56 tokens de entrada, 11 de
  salida y 2.810 ms.
- Guía: estado `completed`, response ID presente, schema válido, 269 tokens de
  entrada, 1.112 de salida y 9.185 ms.
- Contra la muestra anterior de `gpt-4o-mini`, `gpt-5.4-mini` fue 1,66 veces
  más lento y 7,18 veces más costoso en chat; en guía fue 1,38 veces más lento
  y 14,97 veces más costoso.
- Esta comparación sólo demuestra compatibilidad, consumo y latencia. No alcanza
  para afirmar mejor calidad: faltan casos representativos, graders de seguridad
  y exactitud, repeticiones y límites de aceptación.
- La comparación se ejecutó a nivel del servicio proveedor; no fue una prueba
  HTTP/controlador/modelo y no persistió filas en Turso.

### Migración de la generación de guías

Reemplazar la creación de thread, message y run por una única llamada a `responses.parse`.

Forma objetivo aproximada:

```ts
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { guideSchema } from '../schemas/guide.ts'

const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    project: env.OPENAI_PROJECT_ID,
    organization: env.OPENAI_ORGANIZATION_ID,
})

const response = await client.responses.parse({
    model: env.OPENAI_GUIDE_MODEL,
    instructions: BUILDING_GUIDE_INSTRUCTIONS,
    input: buildGuideRequest(openAIProps),
    text: {
        format: zodTextFormat(guideSchema, 'construction_guide'),
    },
    store: false,
})

const guide = response.output_parsed

if (!guide) {
    throw new OpenAIOutputError('The model did not return a valid guide')
}
```

La API oficial permite `responses.parse`, `zodTextFormat` y `response.output_parsed`: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Cambios funcionales:

- Mover las reglas permanentes a `instructions`.
- Enviar categoría, nombre, dimensiones y experiencia como `input` de usuario.
- Dejar de pedir “sólo JSON”; el schema de Structured Outputs define el contrato.
- Eliminar `JSON.parse` y validar nuevamente el objeto antes de persistirlo.
- Tratar `output_parsed === null`, refusal, estado incompleto, timeout y error de proveedor.
- Guardar en `user_models` el snapshot validado junto a `model`, `prompt_version` y fecha.

### Migración del chat

Forma objetivo inicial, preservando el comportamiento de un solo turno:

```ts
const response = await client.responses.create({
    model: env.OPENAI_CHAT_MODEL,
    instructions:
        'Sos un asistente profesional de construcción. Respondé en español de Argentina y priorizá la seguridad.',
    input: message,
    store: false,
    safety_identifier: privacySafeUserId,
})

const answer = response.output_text
```

En Responses, `instructions` reemplaza la guía de sistema superior, `input` contiene el mensaje y `output_text` devuelve el texto final. Esta equivalencia está documentada en la [guía de migración](https://developers.openai.com/api/docs/guides/migrate-to-responses).

### Estado conversacional

La primera entrega debe conservar el comportamiento actual: un turno y `store: false`. Después se puede integrar con las tablas locales de conversaciones.

Opción recomendada para BuildeAR:

- Mantener la base local/Turso como fuente de verdad.
- Cargar una ventana acotada de mensajes autorizados del usuario.
- Convertirlos en Items de entrada y usar `store: false`.
- Resumir o podar historiales largos para controlar tokens.

Opción alternativa:

- Guardar `response.id` y continuar con `previous_response_id`.
- Decidir explícitamente `store: true` y documentar retención.
- Tener en cuenta que los tokens anteriores de la cadena siguen facturándose como input.

OpenAI documenta ambas opciones y la retención por defecto en [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state).

### Selección de modelos

No sustituir automáticamente `gpt-4o-mini` por el modelo flagship. El chat actual cumple un rol de bajo costo y baja latencia, mientras la guía requiere más consistencia estructural.

Matriz de evaluación propuesta:

| Carga | Baseline | Candidatos | Decisión esperada |
|---|---|---|---|
| Chat breve | `gpt-4o-mini` vía Responses | `gpt-5.6-luna` | Elegir por seguridad, latencia, costo y utilidad. |
| Guía constructiva | Modelo configurado en el Assistant actual | `gpt-5.6-terra`; comparar `gpt-5.6-sol` sólo si aporta calidad medible | Priorizar exactitud y cumplimiento del schema. |

La documentación vigente presenta `gpt-5.6-sol` como flagship, `gpt-5.6-terra` como balance y `gpt-5.6-luna` para volumen sensible al costo: [model guidance](https://developers.openai.com/api/docs/guides/latest-model).

Proceso:

1. Registrar el modelo real usado por el Assistant actual antes de eliminarlo.
2. Crear un dataset representativo por categoría y nivel de experiencia.
3. Comparar cumplimiento de schema, seguridad, exactitud, latencia, tokens y costo.
4. Usar alias en desarrollo y snapshots versionados en producción si se necesita estabilidad.
5. Configurar el modelo por entorno, nunca hardcodearlo en el servicio.

### Evals y pruebas OpenAI

El dataset mínimo debe cubrir:

- cinco categorías constructivas;
- tres niveles de experiencia;
- dimensiones mínimas, grandes y entradas inválidas;
- materiales, cantidades, tiempo y costo;
- tareas estructurales o peligrosas que requieran advertencia profesional;
- refusal, timeout, `429`, `5xx` y respuesta incompleta;
- español argentino y ausencia de mojibake;
- prompt injection dentro de `modelName` o mensajes de chat.

Métricas:

- porcentaje de respuesta estructural válida;
- cobertura de advertencias de seguridad;
- evaluación humana de utilidad y corrección;
- p50/p95 de latencia;
- input/output tokens y costo por guía/chat;
- tasa de retries, refusals y errores.

### Rollout de OpenAI

1. Implementar un `OpenAIService` detrás de una interfaz y mocks.
2. Activar Responses sólo en desarrollo.
3. Ejecutar evals offline contra prompts versionados.
4. Habilitar staging con proyecto OpenAI y límites de gasto propios.
5. Hacer canary por porcentaje o usuario interno.
6. Comparar métricas con el baseline.
7. Promover a producción.
8. Retirar definitivamente Chat Completions, Threads, Runs y Assistant ID.

Rollback:

- No reintroducir Threads ni Chat Completions durante el canary.
- Volver a la versión anterior mediante el artefacto y lockfile previos si el
  canary falla.
- El rollback no debe reactivar Assistants debido a su fecha de cierre.

## Fase 5 — Migración Zod 4

**Estado:** ✅ Migración local verificada; falta staging junto con Responses.

Además de su uso con OpenAI, revisar todos los schemas existentes.

Cambios relevantes:

- Reemplazar `JSON.parse(validationResult.error.message)` por `validationResult.error.issues` o un formateador estable.
- Evaluar `z.treeifyError()` para respuestas anidadas.
- Corregir imports a `import * as z from 'zod'` o una convención consistente.
- Revisar defaults, coerción y unknown keys.
- Inferir tipos con `z.infer` y eliminar interfaces duplicadas.
- Verificar que los schemas usados por Structured Outputs produzcan JSON Schema compatible y estricto.

Seguir la [guía oficial de migración de Zod 4](https://zod.dev/v4/changelog).

Gate de salida:

- Todos los schemas tienen tests de éxito y error.
- El formato de errores HTTP es estable.
- `guideSchema` funciona con `responses.parse` y respuestas simuladas/reales de staging.

## Fase 6 — dotenv

```powershell
npm install dotenv@17.4.2
```

Acciones:

- Mantener una única forma de carga (`import 'dotenv/config'`, preload o `node --env-file`), no varias.
- Validar que `tsx watch` y el build productivo reciban las mismas variables.
- Evitar que mensajes de carga ensucien logs o expongan rutas sensibles.
- Centralizar acceso a `process.env` en un módulo `env.ts` validado por Zod.

Gate de salida:

- Desarrollo, test y producción cargan configuración de manera documentada.
- La aplicación falla al inicio con un error claro cuando falta una variable obligatoria.

## Fase 7 — TypeScript y tsconfig

La actualización debe ser escalonada:

```powershell
npm install -D typescript@6
```

**Estado:** TypeScript 6.0.3 verificado con instalación limpia, lint,
typecheck, seis tests, build, migraciones y audit cero.

TypeScript 7.0.2 no se instala todavía: `typescript-eslint` 8.65.0 declara
`typescript >=4.8.4 <6.1.0`. Forzar la major dejaría el toolchain fuera de su
matriz soportada. Cuando exista una versión compatible:

```powershell
npm install -D typescript@7.0.2
```

Cambios de configuración propuestos:

- `target`: alinearlo con Node 26.5.0, usando el nivel ECMAScript validado por TypeScript y por las dependencias del proyecto.
- `module` y `moduleResolution`: mantener `NodeNext` si se conserva ESM.
- `include`: usar `**/*.ts` y excluir `dist`, cobertura y fixtures generados.
- Separar `tsconfig.json` para typecheck de `tsconfig.build.json` para emisión.
- Evitar `allowImportingTsExtensions` en el build si el output JavaScript no puede resolver `.ts`.
- Habilitar gradualmente opciones como `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` después de la migración principal.

Actualizar tipos alineados:

```powershell
npm install -D @types/node@26.1.1
```

Gate de salida:

- Typecheck y build pasan en Node 26.5.0.
- `dist` puede iniciarse sin loader TypeScript si esa es la estrategia elegida.
- Watch mode y source maps funcionan.

## Fase 8 — Limpieza de Passport y tipos de sesión

Si se conservan sesiones/OAuth:

```powershell
npm install -D @types/express-session@1.19.0
npm install -D @types/passport@1.0.17
npm install -D @types/passport-google-oauth20@2.0.17
```

También se deben agregar los runtimes reales decididos (`express-session`, store y `passport-google-oauth20`).

Si se adopta autenticación por token o se retira OAuth:

```powershell
npm uninstall @types/express-session
npm uninstall @types/passport-google-oauth20
```

Retirar también `passport` y `@types/passport` si ya no queda ninguna estrategia Passport.

## Verificación después de cada fase

Ejecutar, en este orden:

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Además:

- Ejecutar migraciones sobre una base vacía y sobre una copia anonimizada del esquema anterior.
- Probar endpoints con el contrato HTTP versionado.
- Hacer smoke tests contra Turso, Cloudinary y OpenAI de staging.
- Verificar que `git diff -- package.json package-lock.json` sólo contenga cambios esperados.
- Revisar licencias y tamaño del árbol con `npm ls --all`.

Resultado operativo local del 2026-07-27:

- `.github/workflows/ci.yml` fija Node 26.5.0 y npm desde el lockfile mediante
  `npm ci`;
- el job usa `file:ci.db` y no recibe secretos de Turso, OpenAI ni Cloudinary;
- ejecuta formato, lint, typecheck, tests, build, aplicación/verificación de
  migraciones y audit;
- los endpoints están montados bajo `/api/v1` sin retirar todavía las rutas
  legacy;
- health/readiness, headers defensivos y shutdown están implementados y
  cubiertos por la suite HTTP;
- una instalación limpia y el smoke de `dist/` pasaron con Node 26.5.0; el
  cierre evita `process.exit()` inmediato para permitir que libSQL drene sus
  handles nativos;
- queda pendiente verificar la primera ejecución alojada después de publicar
  el workflow.

## Estrategia de commits y rollback

Orden sugerido de commits:

1. `test: add modernization baseline`
2. `build: target Node 26.5.0`
3. `chore(deps): apply security patch updates`
4. `fix(db): update libsql client and add migrations`
5. `refactor(http): migrate to Express 5`
6. `refactor(openai): add Responses API adapter`
7. `refactor(openai): migrate guide generation to structured outputs`
8. `refactor(openai): migrate assistant chat to Responses`
9. `chore(validation): migrate to Zod 4`
10. `chore(types): migrate TypeScript and Node types`
11. `chore(auth): align Passport and session dependencies`
12. `docs: document runtime and provider migrations`

Cada commit debe poder revertirse sin depender de commits posteriores, salvo cuando se declare explícitamente una pareja inseparable, como Express/@types/express u OpenAI/Zod Structured Outputs.

## Política de actualizaciones posterior

- Activar Dependabot o Renovate para pull requests semanales.
- Agrupar patch/minor de bajo riesgo y separar majors.
- Ejecutar CI, audit y tests de integración en cada actualización.
- Revisar trimestralmente Node LTS, OpenAI models/deprecations y proveedores.
- Fijar snapshots de modelos OpenAI en producción cuando se requiera comportamiento estable.
- Mantener modelos y versiones SDK como configuración observable.
- No aplicar `npm audit fix --force` sin revisar el diff y los cambios mayores.

## Checklist final

- [ ] Node 26.5.0 declarado y reproducible en desarrollo, CI y despliegue.
- [ ] Las 18 dependencias actuales fueron actualizadas, movidas o retiradas conscientemente.
- [x] `npm audit --omit=dev` no presenta vulnerabilidades conocidas.
- [x] TypeScript 6 pasa tests y build; Express 5/Zod 4 también están
  verificados.
- [ ] TypeScript 7 pasa el gate cuando typescript-eslint lo soporte.
- [ ] `@libsql/client` soporta Turso y `file:` con migraciones.
- [ ] Cloudinary no expone secretos y gestiona el ciclo completo de todos los
  assets. Modelos están cubiertos localmente; faltan perfiles, reintentos y
  smoke test de staging.
- [x] Chat Completions fue reemplazado por Responses.
- [x] Assistants/Threads/Runs fueron reemplazados por Responses.
- [x] Las guías usan Structured Outputs y `guideSchema`.
- [x] La credencial local llega al proveedor y el error real de cuota `429` se
  normaliza sin exponer secretos.
- [x] Chat y guía completan llamadas reales con Responses y metadata devuelta
  al servicio.
- [x] Los endpoints autenticados de staging persisten y permiten verificar la
  metadata real en `ai_generations`.
- [ ] El chat persiste la conversación y ambos mensajes con ownership y
  metadata del asistente.
- [ ] La guía generada se asocia a un `model_id` y se persiste con su metadata,
  o se define un recurso independiente.
- [ ] El modelo OpenAI fue elegido mediante evals, no sólo por ser el más nuevo.
- [ ] Staging y producción tienen proyectos, límites de gasto y métricas separados.
- [ ] Existe rollback documentado y ensayado.

## Fuentes principales

- [OpenAI: Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI: Assistants migration guide](https://developers.openai.com/api/docs/assistants/migration)
- [OpenAI: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI: Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI: Model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)
- [Zod 4 migration guide](https://zod.dev/v4/changelog)
- [Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference)
- [Cloudinary Node SDK](https://cloudinary.com/documentation/node_integration)
- [npm Registry](https://www.npmjs.com/)
