# Backlog técnico de cambios, fixes y mejoras

Fecha de revisión inicial: 20 de julio de 2026.
Última actualización de progreso: 27 de julio de 2026.

Este documento vivo consolida los problemas detectados en el backend de BuildeAR, registra el avance confirmado y propone una hoja de ruta para llevarlo desde su estado actual de MVP a una base mantenible, verificable y segura. Una tarea sólo se considera terminada cuando existe evidencia y se cumple su criterio de aceptación.

## Resumen ejecutivo

Las prioridades inmediatas son:

1. Proteger credenciales y recursos: actualmente no existe autorización real y las respuestas pueden exponer hashes y salts de contraseñas.
2. Incorporar migraciones: `local.db` no coincide con el modelo de datos esperado por el código.
3. Corregir operaciones rotas en mensajes, modelos y cambio de contraseña.
4. Migrar las dos integraciones de OpenAI a Responses API: Chat Completions y Assistants/Threads.
5. Crear una base de tests antes de actualizar dependencias mayores.

## Estado de avance

### Leyenda

- ✅ **Verificado:** existe evidencia técnica observada.
- 🟡 **Ejecutado, pendiente de verificar:** se informó la ejecución, pero falta inspeccionar el resultado.
- 🔵 **Decidido:** se tomó una decisión de arquitectura, todavía no necesariamente implementada.
- ⬜ **Pendiente:** no implementado.
- ⛔ **Bloqueado:** requiere una decisión o acceso que impide continuar.

### Fotografía actual

| Hito | Estado | Evidencia actual | Próxima acción |
|---|---|---|---|
| Documentación inicial del backlog | ✅ Verificado | Este documento y `PLAN_ACTUALIZACION_DEPENDENCIAS.md` fueron creados y validados en UTF-8. | Mantener ambos documentos actualizados por cada entrega. |
| Runtime objetivo Node.js 26.5.0 | ✅ Verificado en checkout y configurado en CI | `.nvmrc`, `engines`, `packageManager`, `@types/node` 26.1.1 y `.github/workflows/ci.yml` quedaron alineados; instalación limpia, gates y smoke test se ejecutaron con Node 26.5.0/npm 11.17.0. | Aplicar la misma versión en despliegue; el Node global del equipo inspeccionado sigue en 22.17.0. |
| `ALTER TABLE` y `CREATE TABLE` propuestos en Turso | ✅ Verificado | Las 14 columnas faltantes y `schema_migrations` fueron aplicadas por MCP el 2026-07-27, después de crear una rama de respaldo. | Consumir las columnas desde el backend. |
| Integridad de Turso | ✅ Verificado | El MCP ejecutó `PRAGMA integrity_check` (`ok`) y `PRAGMA foreign_key_check` (cero filas) el 2026-07-27. | Mantener ambos controles en las pruebas de migración. |
| Tabla remota `users` | ✅ Verificado | El export `drizzle-data-2026-07-20T15_36_21.330Z.json` contiene las 12 columnas requeridas por el código. | Revisar constraints y backfill de valores vacíos antes de endurecer nullability. |
| Listado del esquema remoto | ✅ Verificado | Turso contiene ocho tablas de negocio más `schema_migrations`. | Mantener el esquema mediante el runner versionado. |
| Columnas de las tablas remotas | ✅ Verificado | El MCP confirmó las 14 columnas de metadata y los 28 mensajes legacy quedaron con `status = 'completed'`. | Consumir y completar metadata desde el backend. |
| Foreign keys e integridad referencial | ✅ Verificado | El MCP confirmó ocho FKs declaradas y `PRAGMA foreign_key_check` sin filas. | Definir explícitamente la política `ON DELETE` antes de cambiar el comportamiento actual `NO ACTION`. |
| Índices remotos | ✅ Verificado | El MCP confirmó los ocho índices explícitos propuestos y los índices automáticos de unicidad. | Mantenerlos en la migración inicial reproducible. |
| Seed de categorías | ✅ Verificado | Existen `roof`, `floor`, `wall`, `opening` y `foundation`, con IDs 1–5. | Versionar el seed sin volver a insertarlo en producción. |
| Base local | ✅ Verificado | `local.db` quedó en `0004`: diez tablas, diez índices, cinco categorías, integridad `ok` y cero violaciones FK. El cliente activa y comprueba FKs para toda URL `file:`. | Mantener este control en la suite y repetirlo al actualizar libSQL. |
| Migraciones versionadas | ✅ Verificado localmente y en staging | El runner aplicó `0003`/`0004` a `buildear-db-staging` y validó cuatro checksums, 10 tablas, 10 índices, integridad y FKs. | Ejecutar pruebas funcionales en staging antes de planificar la promoción a producción. |
| Aplicación de las nuevas columnas en el backend | ✅ Verificado localmente | Cada guía/chat registra en `ai_generations` response ID, modelo, prompt, tokens, latencia, estado y error. | Vincular también metadata a mensajes/progreso cuando esos endpoints reciban sus IDs de dominio. |
| Fixes funcionales y seguridad | ✅ Baseline verificado | DTO público, sesiones opacas, ownership, rol persistente, scrypt con rehash PBKDF2, rate limiting, errores centralizados y fixes BUG-001/002/003 están cubiertos por tests HTTP. | Reemplazar el store de rate limiting antes de escalar a múltiples instancias. |
| Dependencias y OpenAI Responses | 🟡 Proveedor y telemetría E2E verificados; contenido pendiente | OpenAI 6.49, Zod 4.4, Express 5.2, Cloudinary 2.10 y demás parches pasan los gates; audit está en cero. Registro, login, chat y guía completaron el flujo HTTP real con `gpt-5.4-mini` y persistieron metadata en staging, pero no el contenido. | Persistir conversación y guía, ampliar evals y ejecutar canary con límites de gasto. |

### Evidencia del corte

Guardar en el ticket o pull request correspondiente, sin incluir datos sensibles:

1. ✅ `PRAGMA foreign_key_list` ejecutado mediante el MCP para las seis tablas relacionales: ocho relaciones declaradas.
2. ✅ `PRAGMA index_list`/`index_info` ejecutado mediante el MCP: ocho índices explícitos y cinco índices automáticos de unicidad.
3. ✅ Seed de `categories` verificado: `roof`, `floor`, `wall`, `opening` y `foundation`.
4. ✅ Los archivos SQL equivalentes a los comandos ejecutados manualmente están versionados y sus checksums coinciden con `local.db`.
5. ✅ El corte de Node/migraciones incluye diff de `package.json`, lockfile, runner, cliente DB, modelos sin DDL y tests.

### Evidencia del corte Node 26 y migraciones — 2026-07-27

- Runtime usado para todas las verificaciones: Node `v26.5.0` oficial para
  Windows x64, ZIP validado con SHA-256
  `d3b2277dbcccfdf24ef6302928f64f484cff1d77a6d3caa3a28f4d20ce9158f6`;
  npm `11.17.0`.
- `npm ci`, `format:check`, `lint`, `typecheck`, `test`, `build` y el smoke
  test HTTP del artefacto `dist/` finalizaron correctamente.
- `npm test`: seis tests, seis aprobados. Cubren base vacía, idempotencia,
  checksums, rollback, HTTP/autenticación/ownership, regresiones críticas y
  OpenAI simulado sin red.
- `npm run db:migrate:verify` sobre `local.db`: cuatro migraciones verificadas,
  sin pendientes, integridad y FKs correctas.
- No se ejecutó DDL ni escritura sobre Turso y no se accedió a `galarte-db`.
- `npm audit --omit=dev` bajó de ocho a seis vulnerabilidades de producción
  después de actualizar libSQL y OpenAI: cuatro altas y dos moderadas.
  Permanecen asociadas principalmente a Cloudinary y Express 4; se
  resolverán por los grupos previstos, sin `audit fix --force`.
- La integración OpenAI fue migrada localmente según documentación oficial:
  Responses es la API recomendada, `store: false` desactiva almacenamiento y
  Structured Outputs en Node admite `responses.parse` con `zodTextFormat`.

### Evidencia del corte de seguridad y regresiones — 2026-07-27

- `PublicUser` y queries explícitas impiden devolver `password` o
  `password_salt` en registro, login, listado y detalle.
- El login emite un token opaco aleatorio; sólo su SHA-256 se guarda en
  `auth_sessions`. Se verificaron `401`, `403`, expiración, logout y revocación
  al cambiar la contraseña.
- Usuarios, favoritos, progreso, conversaciones y mensajes validan ownership.
  Las escrituras del catálogo requieren ahora `users.role = 'admin'`; el
  registro público sólo crea usuarios con rol `user`.
- El middleware central devuelve códigos y `requestId` estables y no expone
  errores SQL/proveedor en respuestas inesperadas.
- Se corrigieron `conversation_messages`, el borrado de mensajes, el mapeo de
  columnas de modelos y el endpoint separado de cambio de contraseña.
- `0003_auth_sessions.sql` fue aplicada y verificada sólo en `file:local.db`.
  Turso no fue modificado durante este corte.
- `0004_auth_hardening.sql` agrega rol y metadata de contraseña. Los hashes
  nuevos usan scrypt asíncrono (`N=2^15`, `r=8`, `p=3`) y un login PBKDF2
  válido provoca rehash automático. También fue aplicada sólo a
  `file:local.db`.
- La estrategia quedó registrada en
  `docs/adr/0001-authentication-and-authorization.md`.
- Login, registro, cambio de contraseña y OpenAI tienen límites configurables
  y respuestas `429` centralizadas. El baseline no emite refresh tokens: una
  sesión expirada exige un nuevo login.
- Con Node `v26.5.0`/npm `11.17.0` pasaron `npm ci`, `format:check`, `lint`,
  `typecheck`, seis tests, `build`, el smoke test de `dist/` y
  `db:migrate:verify`.
- Después de los grupos OpenAI, parches y Express 5,
  `npm audit --omit=dev` no reporta vulnerabilidades.

### Evidencia del corte OpenAI Responses — 2026-07-27

- `openai` quedó en 6.49.0 y Zod en 4.4.3.
- `services/openAI.ts` implementa un proveedor inyectable; producción usa
  Responses y los tests usan un doble local sin credenciales ni red.
- Las guías usan `responses.parse`, `zodTextFormat(guideSchema, ...)` y
  `output_parsed`; el chat usa `responses.create` y `output_text`.
- Ambos flujos fijan `store: false`. No quedan referencias TypeScript a
  Chat Completions, Assistant ID, Threads o Runs.
- `ai_generations` registra usuario, feature, response ID, modelo, versión de
  prompt, tokens, latencia, estado y error, incluyendo respuestas incompletas,
  refusals y fallos del proveedor.
- Se conservó `gpt-4o-mini` como default de chat. La guía exige
  `OPENAI_GUIDE_MODEL`, porque el modelo real del Assistant no estaba
  disponible y no se eligió uno sin evals.

### Evidencia del smoke real de OpenAI — 2026-07-27

- La aplicación reconoció `OPENAI_API_KEY` desde el `.env` local ignorado por
  Git, sin imprimir ni persistir la credencial.
- Con Node 26.5.0 se probaron los dos caminos reales configurados con
  `gpt-4o-mini`: `responses.create` para chat y `responses.parse` con Structured
  Outputs para guías. Ambos mantuvieron `store: false` y finalizaron con estado
  `completed`.
- OpenAI resolvió el alias como `gpt-4o-mini-2024-07-18`. El chat consumió
  57 tokens de entrada y 7 de salida en 1.695 ms; la guía consumió 271 de
  entrada y 512 de salida en 6.653 ms.
- Los dos resultados devolvieron al servicio response ID, modelo, versión de
  prompt, tokens, latencia y estado. La guía cumplió el schema estricto y
  produjo seis pasos y cinco materiales.
- Este smoke invocó `ResponsesOpenAIService` directamente y no pasó por
  `OpenAIModel`/`AiGenerationModel.record`; por lo tanto no persistió esa
  metadata en ninguna base.
- Después del smoke volvieron a pasar los seis tests, typecheck, build,
  verificación de cuatro migraciones y `npm audit --omit=dev` con cero
  vulnerabilidades.
- Sigue pendiente ejecutar una matriz de evals y un canary con presupuesto
  acotado antes de elegir el modelo productivo.

### Comparación inicial con `gpt-5.4-mini` — 2026-07-27

- Se repitieron exactamente el chat breve y la guía estructurada del baseline,
  configurando ambos flujos con `gpt-5.4-mini`. OpenAI resolvió el alias como
  `gpt-5.4-mini-2026-03-17`.
- El chat finalizó `completed`, registró response ID, 56 tokens de entrada,
  11 de salida y 2.810 ms. La guía finalizó `completed`, cumplió el schema,
  registró response ID, 269 tokens de entrada, 1.112 de salida y 9.185 ms.
- Frente a la única muestra de `gpt-4o-mini`, la latencia fue 1,66 veces mayor
  en chat y 1,38 veces mayor en guía. Con precios publicados de USD 0,75/4,50
  por millón de tokens, el costo estimado fue USD 0,00009150 para chat y
  USD 0,00520575 para guía: 7,18 y 14,97 veces el baseline, respectivamente.
- La guía produjo seis pasos y diez materiales, pero esas cantidades no prueban
  mayor calidad. Falta puntuar seguridad, exactitud, completitud, cantidades,
  costo estimado y utilidad sobre un dataset representativo.
- No se cambió el default versionado del repositorio; la selección local por
  variables de entorno continúa fuera de Git.
- La comparación también se ejecutó a nivel de servicio y no insertó filas en
  `ai_generations`.

### Verificación de persistencia OpenAI — 2026-07-27

- Antes del E2E, una consulta de sólo lectura confirmó `COUNT(*) = 0` en
  `ai_generations` tanto para `buildear-db-staging` como para `buildear-db`.
- La persistencia está implementada en `OpenAIModel`: después de una respuesta
  o error llama a `AiGenerationModel.record`. Ese camino sólo se ejecuta al
  invocar el modelo/controlador o los endpoints autenticados, no al probar
  directamente `ResponsesOpenAIService`.
- Se levantó la API con Node 26.5.0 y configuración combinada: credenciales
  OpenAI locales más URL/token de `buildear-db-staging`. Readiness y las cuatro
  migraciones estaban verificadas antes de escribir.
- `POST /api/v1/users` creó el usuario sintético
  `codex1785180400316` (ID 30) con `201`; `POST /api/v1/auth/login` devolvió
  `200` y un bearer token que no se imprimió ni persistió fuera de su hash.
- `POST /api/v1/openai/message` devolvió `200`: la fila `chat` quedó
  `completed` con snapshot `gpt-5.4-mini-2026-03-17`, response ID, prompt
  `chat-responses-v2-context-window`, 56/10 tokens y 1.450 ms.
- `POST /api/v1/openai` devolvió `200`: la fila `guide` quedó `completed` con
  el mismo snapshot, response ID, prompt `guide-responses-v1`, 269/1.312 tokens
  y 10.645 ms. La respuesta HTTP cumplió el schema y produjo ocho pasos y diez
  materiales.
- Una lectura independiente de Turso confirmó las dos filas, proveedor
  `openai`, estados `completed` y `error_code = NULL`. La sesión de prueba fue
  revocada y el servidor detenido; el usuario y las dos filas se conservaron
  en staging para inspección.
- La verificación posterior confirmó para el usuario 30: dos filas en
  `ai_generations`, pero cero en `conversations`, `conversation_messages` y
  `user_models`. `ai_generations` contiene sólo telemetría; no contiene prompts,
  respuestas ni el JSON de la guía.
- Producción continúa con cero filas de `ai_generations` y no contiene al
  usuario sintético. `galarte-db` no fue consultada ni modificada.
- Después del E2E pasaron formato, lint, typecheck, build, los seis tests,
  verificación de las cuatro migraciones local/staging y
  `npm audit --omit=dev` con cero vulnerabilidades.

### Evidencia de staging y contexto conversacional — 2026-07-27

- El commit `719b876` fue publicado en `origin/main` después de repetir
  formato, lint, typecheck, seis tests, build, verificación de migraciones y
  audit con Node 26.5.0.
- Se creó `buildear-db-staging` como branch aislada de `buildear-db`.
  La lectura confirmó `0001`/`0002`, 9 tablas, 8 índices y 5 categorías.
- `db:migrate:staging` aplicó `0003_auth_sessions.sql` y
  `0004_auth_hardening.sql` mediante el runner; no se usó DDL manual.
- `db:migrate:staging:verify` confirmó cuatro migraciones e integridad OK. Una
  lectura independiente mediante Turso verificó 10 tablas, 10 índices,
  columnas `role`/`password_algorithm`/`password_params`,
  `integrity_check = ok` y cero violaciones FK.
- Producción y `galarte-db` no fueron modificados.
- No se leyó ni modificó `galarte-db`.
- `/openAI/message` acepta `conversation_id` opcional. Si se informa, exige
  ownership y carga desde Turso/libSQL un máximo de 12 mensajes y 12.000
  caracteres, priorizando los más recientes.
- El historial se envía a Responses con roles `user`/`assistant`, mantiene
  `store: false` y evita duplicar el mensaje actual cuando ya es el último
  mensaje guardado.
- La versión de prompt de chat avanzó a
  `chat-responses-v2-context-window`. Los tests cubren payload, límites y
  rechazo de conversaciones ajenas.
- Con Node 26.5.0 volvieron a pasar formato, lint, typecheck y los seis tests.
- `npm run db:migrate` confirmó que `local.db` ya estaba al día y
  `db:migrate:verify` validó las cuatro migraciones. El smoke local devolvió
  `200` para inicio/live/readiness y `401` para `/api/v1/users` sin sesión.
- `.env.staging` quedó git-ignorado. `db:migrate:staging` y
  `db:migrate:staging:verify` lo cargan explícitamente sin alterar el `.env`
  local ni exponer su token.

### Evidencia de uploads y Cloudinary — 2026-07-27

- `services/uploads.ts` inspecciona firma, extensión y MIME; sólo admite GLB o
  glTF 2.x para el recurso 3D y JPEG, PNG o WebP para la previsualización.
- Los límites por defecto son 20 MiB para el modelo y 5 MiB para la imagen,
  además del límite multipart global. Ambos son configurables sin credenciales.
- El SHA-256 se calcula desde el archivo temporal y se persiste junto a
  `model_public_id`, `image_public_id`, `model_format` y
  `model_size_bytes`.
- Cloudinary dejó de ocultar errores o imprimirlos en consola. El adaptador es
  inyectable y los tests usan un doble local, sin red.
- La creación ya no fuerza `model_data = ''`; usa `resource_type: raw` para el
  recurso 3D e `image` para la previsualización.
- Crear/actualizar elimina assets recién subidos si falla la persistencia;
  actualizar/eliminar limpia los public IDs reemplazados con invalidación.
- El test HTTP multipart acepta un GLB 2.0 válido, comprueba metadata y rechaza
  con `415 MODEL_CONTENT_INVALID` un archivo disfrazado.
- Permanecen pendientes el lifecycle de imágenes de perfil, reintentos
  durables para limpiezas fallidas, metadata completa de imagen/versión y un
  smoke test con Cloudinary de staging.

### Evidencia de contrato y operación — 2026-07-27

- Todos los routers también están disponibles bajo `/api/v1`; las rutas
  legacy siguen funcionando y emiten `Deprecation: true` más un enlace a la
  versión sucesora.
- El middleware defensivo elimina `x-powered-by` y agrega CSP cerrada,
  `nosniff`, `DENY`, referrer policy, permissions policy y aislamiento de
  opener.
- `/health/live` verifica el proceso y `/health/ready` ejecuta `SELECT 1`
  contra la base, devolviendo un error estable `503 DATABASE_NOT_READY` ante
  fallos.
- `index.ts` maneja `SIGTERM`/`SIGINT`, deja de aceptar conexiones, cierra
  libSQL y aplica un timeout de salida de 10 segundos.
- `.github/workflows/ci.yml` usa las acciones oficiales
  `actions/checkout@v7` y `actions/setup-node@v7`, Node 26.5.0 exacto,
  permisos de sólo lectura y `file:ci.db`. Ejecuta instalación limpia,
  formato, lint, typecheck, tests, build, migraciones y audit sin secretos.
- Una instalación limpia pasó formato, lint, typecheck, seis tests, build,
  verificación de cuatro migraciones y audit sin vulnerabilidades. El smoke
  del artefacto compilado devolvió `200` en live/readiness, headers defensivos
  y routing `/api/v1`.
- El smoke detectó y corrigió un cierre nativo abrupto: shutdown ahora fija
  `process.exitCode` después de cerrar HTTP/libSQL y permite drenar el event
  loop, en vez de llamar inmediatamente a `process.exit()`.
- La primera ejecución alojada del workflow se verificará cuando estos
  cambios sean publicados. npm mantiene un aviso operativo para revisar el
  script `postinstall` de `esbuild`, sin vulnerabilidades reportadas.
- Passport, OAuth y sus tipos huérfanos fueron retirados.
- Los gates automatizados no hacen llamadas reales a OpenAI ni requieren
  credenciales; el smoke real se ejecuta por separado y no imprime secretos.

### Evidencia del corte de dependencias y Express 5 — 2026-07-27

- Se actualizaron Cloudinary 2.10.0, CORS 2.8.6, express-fileupload 1.5.2,
  dotenv 17.4.2 y sus tipos compatibles.
- CORS usa una allowlist por entorno; los tests cubren origen permitido y
  rechazado.
- Uploads tienen límite global configurable de 20 MiB, aborto al excederlo,
  nombres seguros y directorios no creados automáticamente.
- Express 5.2.1 y `@types/express` 5.0.6 pasan routing, errores async, HTTP,
  typecheck y build.
- `npm audit --omit=dev`: cero vulnerabilidades. No se ejecutó
  `npm audit fix --force`.
- Con Node 26.5.0/npm 11.17.0 pasaron nuevamente `npm ci`, formato, lint,
  typecheck, seis tests, build, migraciones y smoke test de `dist/`.
- TypeScript 6.0.3 pasa todos los gates. TypeScript 7 queda pospuesto porque
  `typescript-eslint` 8.65.0 declara compatibilidad `<6.1.0`.

### Evidencia de esquema Turso recibida

| Archivo | Resultado identificado |
|---|---|
| `drizzle-data-2026-07-20T15_36_21.330Z.json` | `table_info('users')` |
| `drizzle-data-2026-07-20T15_42_25.099Z.json` | `table_list` |
| `drizzle-data-2026-07-20T15_42_33.049Z.json` | `table_info('ai_generations')` |
| `drizzle-data-2026-07-20T15_42_37.063Z.json` | `table_info('conversation_messages')` |
| `drizzle-data-2026-07-20T15_42_40.513Z.json` | `table_info('conversations')` |
| `drizzle-data-2026-07-20T15_42_44.186Z.json` | `table_info('favorites')` |
| `drizzle-data-2026-07-20T15_42_47.918Z.json` | `table_info('user_models')` |
| `drizzle-data-2026-07-20T15_42_52.148Z.json` | `table_info('models')` |
| `drizzle-data-2026-07-20T15_42_55.557Z.json` | `table_info('categories')` |

### Resultado de la comparación

Confirmado:

- `categories` y `ai_generations` existen con las columnas propuestas.
- Las tablas base que utiliza el backend están presentes en Turso.
- `models.model_checksum`, `user_models.generation_status`, `conversations.last_message_at` y `conversation_messages.error_code` fueron agregadas.
- No se detectaron violaciones mediante `foreign_key_check`.
- Las ocho relaciones esperadas están declaradas; actualmente todas usan `NO ACTION` para `ON UPDATE` y `ON DELETE`.
- Están creados `idx_models_category`, `idx_user_models_user`, `idx_user_models_model`, `idx_favorites_user`, `idx_conversations_user`, `idx_conversation_messages_conversation_created`, `idx_ai_generations_user_created` e `idx_ai_generations_feature`.
- Las cinco categorías esperadas están sembradas.

Metadata agregada el 2026-07-27:

- `models`: `model_public_id`, `image_public_id`, `model_format`, `model_size_bytes`.
- `user_models`: `openai_response_id`, `openai_model`, `prompt_version`, `generated_at`.
- `conversations`: `title`, `summary`.
- `conversation_messages`: `status`, `openai_response_id`, `input_tokens`, `output_tokens`.
- Tabla creada: `schema_migrations`, con `0001` y `0002` registradas por checksum.

Riesgos de datos legacy detectados por defaults:

- `users.name` y `users.surname` admiten el default vacío usado durante el ALTER.
- `users.experience_level` es nullable.
- `models.position` usa `""` como default y `height`/`width` usan `0`, valores que el schema HTTP rechaza.
- `user_models.current_step` usa default `0`, mientras el schema de aplicación espera un entero positivo con default `1`.
- Los PRAGMAs ejecutados por MCP confirmaron FKs, índices y unicidad; falta decidir las políticas de borrado y versionar esas definiciones.

La auditoría agregada confirmó que los datos remotos actuales no presentan esos
valores legacy: cero nombres vacíos, cero experiencias nulas, cero
dimensiones/posiciones inválidas y cero progresos con `current_step <= 0`.
Se conserva `ON DELETE NO ACTION` para evitar un rebuild destructivo; los
borrados relacionados deberán resolverse explícitamente en la capa de servicio.

## Convenciones del backlog

- **P0 — Bloqueante:** riesgo de seguridad, pérdida de datos o funcionalidad principal rota.
- **P1 — Alta:** necesario para una API estable y operable.
- **P2 — Media:** calidad, mantenibilidad y experiencia de desarrollo.
- **P3 — Evolutiva:** optimización o capacidad futura.

Cada tarea debería implementarse en un cambio pequeño, revisable y con tests. Los cambios de comportamiento o contrato deben documentarse antes de desplegarse.

## P0 — Seguridad y autenticación

### AUTH-001 — No devolver credenciales

**Estado:** ✅ Resuelto y cubierto por tests el 2026-07-27.

**Problema:** los modelos consultan `SELECT *` y los endpoints de usuario, registro y login pueden devolver `password` y `password_salt`.

**Cambios sugeridos:**

- Crear un DTO público `PublicUser` que incluya únicamente datos presentables al cliente.
- Seleccionar columnas explícitas en queries públicas.
- Mantener un método interno separado para obtener credenciales durante el login.
- Aplicar el mismo filtrado a logs, errores y fixtures.

**Criterios de aceptación:**

- Ninguna respuesta HTTP contiene `password` ni `password_salt`.
- Un test de contrato verifica que esos campos no estén presentes en registro, login, listado y detalle.

### AUTH-002 — Implementar autenticación y autorización reales

**Estado:** ✅ Resuelto para el baseline. Hay sesiones opacas con hash, expiración y revocación,
middleware de autenticación, ownership y autorización mediante el rol
persistente `users.role`. Hay rate limiting y el ADR 0001 decide no emitir
refresh tokens inicialmente. Antes de escalar horizontalmente se debe adoptar
un store compartido para los límites.

**Problema:** el login sólo comprueba la contraseña. No genera sesión ni token, y todos los recursos están expuestos sin verificar identidad o propiedad.

**Cambios sugeridos:**

- Elegir y documentar una estrategia: sesión segura con cookie `HttpOnly` o access token de corta duración con refresh token rotativo.
- Agregar middleware `requireAuth` y autorización por propietario/rol.
- Proteger usuarios, favoritos, progreso, conversaciones, mensajes, carga de archivos y llamadas a OpenAI.
- Restringir el CRUD del catálogo a un rol administrativo.
- Obtener el usuario autenticado del contexto de seguridad; no confiar en `userId` enviado por el cliente.
- Definir revocación, expiración, logout y rotación de secretos.

**Criterios de aceptación:**

- Un usuario no puede leer o modificar recursos de otro usuario.
- Los endpoints administrativos rechazan usuarios comunes.
- Existen tests de `401`, `403`, expiración y logout.

### AUTH-003 — Fortalecer contraseñas

**Estado:** ✅ Resuelto para el baseline. Las contraseñas nuevas usan scrypt
asíncrono con parámetros versionados; la comparación usa `timingSafeEqual` y
los hashes PBKDF2 legacy se rehashean automáticamente después de un login
válido.

**Problema:** PBKDF2 se ejecuta sincrónicamente con 10.000 iteraciones y la comparación usa igualdad normal.

**Cambios sugeridos:**

- Adoptar Argon2id o `crypto.scrypt` asíncrono con parámetros versionados.
- Usar comparación constante en tiempo.
- Guardar el algoritmo y parámetros junto al hash para permitir rehash progresivo.
- Definir política de longitud, contraseñas comprometidas y recuperación de cuenta.
- Rehashear en el siguiente login cuando el hash use el esquema anterior.

**Criterios de aceptación:**

- El event loop no se bloquea durante hashing.
- Los hashes antiguos pueden migrarse sin invalidar cuentas.
- Existen tests para contraseña correcta, incorrecta, cambio y rehash.

### AUTH-004 — Completar o retirar Google OAuth

**Estado:** ✅ Retirado. Se eliminaron el callback incompleto, Passport, los
tipos de sesión/OAuth y la interfaz Google sin consumidores.

**Problema:** existe sólo el callback. Faltan la estrategia, inicialización de Passport, endpoint de inicio, runtime de `passport-google-oauth20` y manejo de cuentas existentes.

**Cambios sugeridos:**

- Definir si OAuth seguirá dentro del alcance del producto.
- Si se conserva: instalar el runtime, configurar `passport.initialize()`, crear `/auth/google`, validar `state`, definir callback y vincular por un identificador de proveedor estable.
- Evitar crear un usuario nuevo en cada callback.
- Resolver colisiones de username y asociación segura con cuentas existentes.
- No crear contraseñas vacías para identidades externas.
- Si se retira: eliminar Passport, rutas y tipos relacionados.

**Criterios de aceptación:**

- El flujo completo funciona en un entorno de prueba y resiste repetición de callback y colisiones.
- La decisión de sesión/token es consistente con AUTH-002.

## P0 — Base de datos e integridad

### DB-001 — Incorporar migraciones versionadas

**Problema:** las tablas se crean dentro de las operaciones de escritura. `CREATE TABLE IF NOT EXISTS` no actualiza esquemas antiguos y no existe historial de migraciones.

**Cambios sugeridos:**

- Adoptar una herramienta de migraciones compatible con libSQL/Turso o un runner SQL propio con tabla `schema_migrations`.
- Crear una migración inicial que represente todo el esquema real.
- Mover todo DDL fuera de los modelos.
- Ejecutar migraciones de forma explícita durante despliegue, no en cada request.
- Agregar seeds idempotentes para categorías.

**Criterios de aceptación:**

- Una base vacía puede prepararse con un único comando.
- Las migraciones se ejecutan una sola vez y se pueden probar en CI.
- Iniciar la aplicación no modifica silenciosamente el esquema.

### DB-002 — Reemplazar o migrar `local.db`

**Estado:** ✅ Resuelto el 2026-07-27.

La base versionada contenía sólo una tabla `users` antigua y tres filas sin
`password_salt`. Se conservó en `.backups/local.legacy-20260727.db` y la
`local.db` activa se regeneró desde las migraciones, sin datos personales.

Decisión: mantener una `local.db` vacía y reproducible como fixture temporal
versionado. Cuando exista el runner, podrá dejar de versionarse y generarse con
un comando.

**Criterios de aceptación:**

- Un clon nuevo no depende de una base binaria preexistente.
- La base local creada por migraciones pasa `integrity_check` y tiene el mismo esquema que Turso.

### DB-003 — Activar restricciones e integridad referencial

**Cambios sugeridos:**

- Habilitar y comprobar claves foráneas.
- Crear la tabla `categories` antes de `models`.
- Definir `ON DELETE` y `ON UPDATE` explícitos.
- Agregar restricciones para enums, booleanos, dimensiones y progreso.
- Crear índices para búsquedas por usuario, modelo, conversación y timestamps.
- Definir unicidad de nombres de modelo si esa es una regla del dominio.

**Criterios de aceptación:**

- No se pueden crear favoritos, obras o mensajes huérfanos.
- El plan de borrado de usuarios/modelos tiene comportamiento probado.

### DB-004 — Operaciones atómicas y resultados confiables

**Cambios sugeridos:**

- Usar transacciones para cargas múltiples y operaciones compuestas.
- Sustituir consultas de “último registro” por `RETURNING` o identificadores de inserción.
- Verificar `rowsAffected` en updates y deletes.
- Actualizar `updated_at` en cada modificación.
- Parsear `guide` al leer `user_models`, o normalizar la guía en tablas si debe consultarse por componentes.

**Criterios de aceptación:**

- Un fallo intermedio no deja mensajes parciales.
- Actualizar o borrar un ID inexistente devuelve `404` y no éxito.

## P0 — Bugs funcionales

### BUG-001 — Corregir mensajes de conversación

**Estado:** ✅ Resuelto y cubierto por tests de creación, consulta, listado y
borrado sin eliminar la conversación.

**Problemas:**

- `get` y `delete` consultan `conversation_message`, pero la tabla creada es `conversation_messages`.
- El controlador de borrado llama a `ConversationModel.delete` en vez de `ConversationMessageModel.delete`.

**Criterios de aceptación:**

- Crear, consultar, listar y borrar un mensaje funciona sin afectar la conversación.
- Hay tests de integración para las cuatro operaciones.

### BUG-002 — Corregir actualización de modelos

**Estado:** ✅ Resuelto localmente. El update usa las columnas reales, mapea
todos los campos soportados, reemplaza assets y elimina los uploads nuevos si
falla una etapa posterior.

**Problemas:**

- El SQL actualiza columnas inexistentes `data` e `image`; la tabla usa `model_data` y `model_image`.
- Se leen propiedades inexistentes como `currentModel.model` y `difficultyRating`.
- El schema acepta campos que el modelo ignora.
- Los uploads se realizan antes del `try/catch`.

**Cambios sugeridos:**

- Definir una única nomenclatura entre API, tipos y base de datos.
- Construir el `UPDATE` sólo con campos presentes o mapear todos explícitamente.
- Incluir categoría, dimensiones y posición si se permiten en el contrato.
- Encapsular upload y persistencia; borrar el asset nuevo si falla la transacción.

### BUG-003 — Corregir cambio de contraseña

**Estado:** ✅ Resuelto. Existe `POST /users/me/password`, valida la contraseña
actual, actualiza el hash y revoca las sesiones existentes.

**Problema:** `validPartialUserData` elimina `password` y `newPassword`, por lo que nunca llegan a `UserModel.update`.

**Cambios sugeridos:**

- Separar `PATCH /users/:id` de `POST /users/me/password`.
- Validar contraseña actual y nueva en el endpoint específico.
- Invalidar sesiones/tokens anteriores según la política definida.

### BUG-004 — Implementar realmente el recurso 3D/AR

**Estado:** 🟡 Implementación local verificada con proveedor simulado. La
creación persiste GLB/glTF e imagen, URL, public IDs, formato, tamaño y SHA-256.
Falta un smoke test contra Cloudinary de staging y decidir columnas adicionales
para versión y metadata completa de la imagen.

**Problema:** la creación fuerza `data: ''`; la carga del modelo está comentada y sólo se guarda la imagen.

**Cambios sugeridos:**

- Definir formatos permitidos (`glb`, `gltf` u otros), límites y MIME reales.
- Usar `resource_type: raw` o `auto` en Cloudinary cuando corresponda.
- Persistir URL, `public_id`, versión, tamaño, checksum y formato.
- Implementar reemplazo y eliminación de assets.

**Criterios de aceptación:**

- Un modelo recuperado contiene una URL 3D utilizable y una imagen de previsualización.
- Archivos inválidos se rechazan antes de subirlos.

## P0 — OpenAI y seguridad del contenido

### AI-001 — Migrar a Responses API

**Estado:** ✅ Implementación y smoke real verificados. Ambos flujos usan
Responses, el código legacy fue retirado y chat/guía finalizaron correctamente
con `gpt-4o-mini`. Faltan evals comparativas y canary.

### AI-002 — Structured Outputs para las guías

**Estado:** ✅ Implementación local verificada con schema estricto, resultado
simulado, incomplete output y refusal.

**Cambios sugeridos:**

- Reutilizar `guideSchema` con `responses.parse` y `zodTextFormat`.
- Eliminar el parseo manual de JSON.
- Tratar explícitamente respuestas incompletas, refusals, timeouts y resultados nulos.
- Versionar el prompt y guardar modelo, versión de prompt y métricas junto a cada guía.

### AI-003 — Controles de producto para consejos de construcción

**Riesgo:** una guía incorrecta puede causar lesiones, daños estructurales o estimaciones económicas engañosas.

**Cambios sugeridos:**

- Delimitar tareas que requieren un profesional matriculado.
- Agregar advertencias según categoría, complejidad y riesgo.
- Evitar presentar costo y tiempo como valores garantizados; registrar moneda, fecha y supuestos.
- Crear una batería de evaluaciones revisada por una persona experta en construcción.
- Moderar entradas abusivas y establecer límites de uso.

### AI-004 — Persistir el contenido generado y su trazabilidad

**Estado:** ⬜ Pendiente. Regresión de integración confirmada por E2E de
staging; no es una diferencia ni una falla del esquema SQL.

**Problema:**

- `/api/v1/openai/message` sólo carga contexto cuando recibe
  `conversation_id`; no crea una conversación ni inserta el mensaje del usuario
  o la respuesta del asistente.
- `/api/v1/openai` devuelve la guía y registra telemetría, pero no crea ni
  actualiza `user_models`. El request actual no incluye el `model_id` requerido
  por esa tabla.
- Las columnas de metadata ya existen en `conversation_messages` y
  `user_models`, pero no son completadas por los flujos OpenAI.

**Causa confirmada — 2026-07-27:**

- En el código anterior a la modernización, `/openAI` y `/openAI/message`
  únicamente devolvían el contenido generado. La guía se guardaba mediante una
  segunda llamada a `POST /userModels`, cuyo controlador transformaba
  `guideObject` y cuyo modelo insertaba `guide`, `completed` y `current_step`.
- De la misma manera, las conversaciones y sus mensajes se creaban mediante
  los endpoints separados de `conversations` y `conversationMessages`; el
  endpoint OpenAI anterior tampoco hacía esas inserciones.
- La modernización conservó esos modelos y tablas, corrigió sus queries y
  agregó ownership, pero el nuevo flujo HTTP de OpenAI sólo incorporó
  telemetría en `ai_generations`. No integró ni reemplazó la coordinación de
  escrituras que antes realizaba el cliente.
- El E2E ejecutado llamó sólo a los endpoints OpenAI, por lo que demostró esa
  regresión de contrato: no faltan tablas o columnas y no se debe modificar el
  esquema de Turso para corregirla.

**Cambios requeridos:**

- Exigir o crear una conversación, validar ownership y persistir en forma
  atómica los mensajes `user`/`assistant`; vincular la fila del asistente con
  response ID, tokens, estado y error.
- Definir el contrato de guía: agregar `model_id` validado y hacer upsert en
  `user_models`, o crear un recurso de guía independiente si una guía no siempre
  pertenece a un modelo existente.
- Agregar regresiones para éxito, error del proveedor, ownership y rollback
  parcial, tanto en `file:` como en Turso staging.

## P1 — Contrato HTTP y validación

### API-001 — Normalizar estados y respuestas

- `200` para lecturas y updates exitosos, `201` sólo para creación y `204` cuando no hay cuerpo.
- `400` para request inválido, `401`/`403` para seguridad, `404` para ausencias, `409` para conflictos, `422` si se adopta para validación y `502`/`503` para proveedores externos.
- Adoptar una respuesta de error estable: `code`, `message`, `details`, `requestId`.
- Elegir un idioma consistente para mensajes internos y externos.

### API-002 — Validar parámetros, query y cuerpos completos

- Usar Zod para params y query, evitando coerción directa a `NaN`.
- Exigir strings no vacíos y aplicar máximos de longitud.
- Validar sender contra un enum.
- Unificar snake_case o camelCase en la frontera HTTP.
- Validar multipart antes de subir archivos.
- Corregir rangos: `experience_level` debe tener mínimo y máximo.

### API-003 — Versionar la API

- Introducir `/api/v1` antes de cambiar contratos públicos.
- Publicar OpenAPI y generar ejemplos verificados.
- Mantener una política explícita de deprecación.
- Actualizar `api.http` para que pueda actuar como smoke test manual.

### API-004 — Manejo central de errores

- Crear errores de dominio tipados.
- Agregar middleware 404 y middleware final de errores.
- En Express 4, envolver handlers asíncronos; al migrar a Express 5, aprovechar el forwarding automático de promesas rechazadas.
- No enviar mensajes SQL, secretos ni detalles de proveedores al cliente.

## P1 — Archivos, Cloudinary y perímetro

### MEDIA-001 — Endurecer uploads

**Estado:** 🟡 Modelos verificados localmente. `services/uploads.ts` valida
extensión, MIME declarado y firma real de GLB/glTF 2.x, JPEG, PNG y WebP; aplica
límites separados, calcula SHA-256 y usa el directorio temporal del sistema.
Las imágenes de perfil conservan el contrato legacy y requieren una fase
separada.

- Reducir el límite global de 50 MB o establecer límites por tipo.
- Validar extensión, MIME detectado por contenido, dimensiones y tamaño.
- Usar nombres internos no controlados por el usuario.
- Limpiar temporales en `finally`.
- Evitar que el upload acepte rutas o URLs arbitrarias no confiables.

### MEDIA-002 — Gestionar ciclo de vida de assets

**Estado:** 🟡 Modelos verificados localmente. Cloudinary usa un proveedor
inyectable, nombres internos con UUID y `resource_type: raw` para 3D. Crear y
actualizar compensan assets nuevos ante errores; actualizar y eliminar limpian
public IDs reemplazados. Faltan reintentos durables de limpieza y lifecycle de
imágenes de perfil.

- Guardar `public_id` además de la URL.
- Borrar o reemplazar assets al actualizar/eliminar entidades.
- Compensar uploads si falla la escritura en base.
- Configurar Cloudinary con `hide_sensitive: true` y nunca imprimir errores con secretos.

### SEC-001 — Endurecer Express

**Estado:** 🟡 Parcial. Ya existen CORS por entorno, límites de body/upload,
validación de contenido de modelos, `requestId`, timeouts OpenAI y rate
limiting específico; faltan headers de seguridad y validación de imágenes de
perfil.

- Configurar CORS con allowlist por entorno.
- Agregar headers de seguridad, límites de body y rate limiting.
- Aplicar límites específicos a login, OpenAI y uploads.
- Incluir `requestId`, protección contra abuso y timeouts de proveedores.
- Definir política de proxy confiable sólo para el entorno de despliegue.

## P1 — Observabilidad y operación

### OPS-001 — Configuración validada

- Centralizar variables de entorno en un schema Zod cargado al inicio.
- Fallar rápido cuando falten secretos obligatorios.
- Crear `.env.example` sin credenciales.
- Corregir nombres OpenAI y eliminar `OPEN_AI_ASSITANT_ID` tras la migración.
- Separar configuración de desarrollo, test, staging y producción.

### OPS-002 — Logging y métricas

**Estado:** 🟡 Parcial. OpenAI registra modelo, response ID, tokens, latencia,
estado y error en `ai_generations`; faltan métricas equivalentes para DB y
Cloudinary.

- Usar logs JSON con request ID y redacción de secretos.
- Registrar latencia, estado y proveedor sin guardar mensajes sensibles por defecto.
- Medir errores y duración de DB, Cloudinary y OpenAI.
- Registrar uso de tokens y modelo para controlar costo.
- Incorporar endpoints `/health/live` y `/health/ready`.

### OPS-003 — Apagado y resiliencia

- Manejar `SIGTERM`/`SIGINT` y cerrar conexiones correctamente.
- Configurar timeouts y retries con backoff sólo para fallos transitorios.
- Evitar retries automáticos de operaciones no idempotentes sin clave de idempotencia.

## P1 — Tests y calidad

### TEST-001 — Crear una pirámide mínima de pruebas

- Unit tests para schemas, passwords, prompt builders y mapeos.
- Integration tests de modelos contra una base temporal migrada.
- API tests para autenticación, propiedad, códigos HTTP y errores.
- Contract tests para asegurar que nunca se filtren campos sensibles.
- Evals deterministas y fixtures para la integración OpenAI, sin llamar a producción en cada test.

### TEST-002 — Automatización de calidad

Agregar scripts reproducibles:

- `format` y `format:check`
- `lint`
- `typecheck`
- `test` y `test:coverage`
- `build`
- `start`
- `db:migrate` y `db:seed`

La CI debe ejecutar instalación limpia, auditoría, lint, typecheck, tests, build y migraciones sobre una base vacía.

## P2 — Estructura y mantenibilidad

### ARCH-001 — Separar responsabilidades

- Extraer acceso a proveedores a servicios (`OpenAIService`, `CloudinaryService`).
- Usar repositorios para persistencia y evitar que las clases llamadas “Model” mezclen DDL, queries y servicios externos.
- Introducir una capa de casos de uso para autorización, transacciones y reglas del dominio.
- Inyectar dependencias para permitir tests sin red.

### ARCH-002 — Unificar tipos con schemas

- Inferir tipos desde Zod mediante `z.infer` en lugar de duplicar interfaces manuales.
- Separar entidades de persistencia, DTOs de entrada y DTOs públicos.
- Normalizar `created_at`/`updated_at`, `createdAt`/`updatedAt` y tipos booleanos.
- Eliminar tipos y archivos sin uso, incluido el controlador vacío de Cloudinary.

### ARCH-003 — Mejorar TypeScript y build

- Incluir recursivamente `**/*.ts`.
- Usar un target moderno alineado con Node 26.5.0.
- Mantener un `tsconfig` de typecheck y otro de build si se compila a `dist`.
- Corregir `main`, agregar `start` y evitar depender de `npx` dentro de scripts normales.
- Decidir si producción ejecutará JavaScript compilado o TypeScript mediante `tsx`; documentar una sola estrategia.

### ARCH-004 — Corregir formato y encoding

- Reparar los textos con mojibake (`construcciÃ³n`, `PÃ¡gina`, etc.).
- Configurar editor y CI para UTF-8 y finales de línea consistentes.
- Reemplazar la configuración ESLint inválida y agregar las dependencias reales de lint.

## P2 — Documentación y experiencia de desarrollo

### DOC-001 — README operativo

Debe incluir:

- objetivo del producto y arquitectura;
- requisitos y versión de Node;
- instalación y variables de entorno;
- comandos de desarrollo, tests, build y migraciones;
- contrato de autenticación;
- enlaces a OpenAPI;
- estrategia de despliegue y rollback.

### DOC-002 — Decisiones de arquitectura

Crear ADRs para:

- sesión frente a tokens;
- Turso remoto frente a SQLite local/embedded replica;
- almacenamiento de conversaciones OpenAI;
- modelo OpenAI seleccionado por carga;
- persistencia JSON de guías frente a normalización;
- almacenamiento de modelos 3D.

## P3 — Mejoras evolutivas

- Paginación y filtros en todos los listados.
- Búsqueda con FTS en lugar de `LIKE` cuando el catálogo crezca.
- Caché de catálogo y guías idempotentes.
- Idempotency keys para creación de guía, favorito y progreso.
- Soft delete y auditoría para entidades críticas.
- Webhooks o streaming para tareas de IA largas.
- Cola de trabajos para uploads, generación de guías y procesamiento 3D.
- Feature flags para despliegues graduales.

## Plan de implementación de este backlog

### Resumen del plan

| Fase | Estado | Dependencias | Entregable principal | Gate de salida |
|---|---|---|---|---|
| 0. Trazabilidad y esquema real | ✅ Verificado | Acceso de lectura a Turso | Esquema remoto registrado y SQL versionado | `table_list`, `table_info`, integridad y foreign keys documentados |
| 1. Baseline reproducible | 🟡 En curso | Fase 0 | Node 26.5.0, instalación limpia, tests mínimos y CI | Gates locales verdes y workflow creado; falta observar su primera ejecución |
| 2. Base e integridad | 🟡 En curso | Fases 0–1 | Migraciones, base local limpia, categorías, índices y FKs | Runner verde local/staging; falta política automática de timestamps |
| 3. Seguridad y fixes P0 | ✅ Baseline verificado | Fases 1–2 | DTO público, auth mínima y CRUD corregidos | Tests de secretos, roles, rehash, límites y bugs críticos verdes |
| 4. OpenAI y contenido | 🟡 Implementación local verificada | Fases 1–3 | Responses API, Structured Outputs, contexto, auditoría y evals | Código legacy retirado y contexto acotado; faltan evals/canary reales |
| 5. API y dependencias mayores | 🟡 En curso | Fases 1–4 | Express 5, Zod 4, TypeScript y contrato `/api/v1` | `/api/v1`, Express/Zod/TS6 verdes; falta OpenAPI y soporte del linter para TS7 |
| 6. Media y producción | 🟡 En curso | Fases 2–5 | Recurso 3D, observabilidad, health checks y rollout | Upload 3D local verde; faltan perfil, staging, observabilidad y rollback |

### Fase 0 — Trazabilidad y validación de Turso

- [x] Registrar que los `ALTER TABLE` y `CREATE TABLE` fueron ejecutados por el equipo.
- [x] Confirmar `PRAGMA integrity_check = ok`.
- [x] Verificar `PRAGMA table_info('users')`: las 12 columnas esperadas están presentes.
- [x] Ejecutar y guardar `PRAGMA table_list`.
- [x] Verificar `table_info` de las ocho tablas existentes.
- [x] Ejecutar `PRAGMA foreign_key_check`: no devolvió filas.
- [x] Confirmar la ausencia inicial de `schema_migrations`; posteriormente fue creada y poblada.
- [x] Ejecutar `PRAGMA foreign_key_list` para tablas con relaciones: ocho FKs confirmadas.
- [x] Ejecutar `PRAGMA index_list` para confirmar índices y unicidad: ocho índices explícitos más los automáticos.
- [x] Completar las 14 columnas propuestas que no aparecían en los exports.
- [x] Auditar datos legacy de `users`: no existen nombres vacíos ni `experience_level` nulo en Turso.
- [x] Auditar `models` y `user_models`: no existen dimensiones/posición inválidas ni `current_step <= 0`.
- [x] Comparar el esquema real con los campos documentados mediante el MCP de Turso.
- [x] Convertir los comandos manuales en dos migraciones SQL versionadas y registradas por checksum.

Entregable: inventario de esquema remoto más migraciones SQL revisables.
Gate: ninguna tabla o columna se marca como completada sin aparecer en la salida de los PRAGMA.

### Fase 1 — Baseline reproducible

- [x] Publicar el baseline de modernización en `main` (`719b876`).
- [x] Aplicar Node 26.5.0 en `.nvmrc`, `engines`, tipos y gates locales.
- [x] Crear `.env.example` sin secretos y con fallback `file:local.db`.
- [x] Incorporar scripts `format`, `format:check`, `lint`, `typecheck`, `test`, `test:coverage`, `build`, `start` y migraciones.
- [x] Agregar tests de caracterización para usuarios, modelos, mensajes y OpenAI simulado.
- [x] Registrar auditoría y fallos preexistentes.

Entregable: checkout reproducible y baseline automatizado.
Gate: `npm ci`, typecheck y tests mínimos pueden ejecutarse sin proveedores reales.

### Fase 2 — Migraciones y consistencia de datos

- [x] Crear y poblar `schema_migrations`.
- [x] Implementar el runner idempotente y transaccional con validación de checksum.
- [x] Crear migración inicial completa, incluyendo categorías e índices.
- [x] Incorporar la migración equivalente a los cambios ejecutados en Turso.
- [x] Agregar `0003_auth_sessions.sql` y aplicarla sólo a `file:local.db`.
- [x] Agregar `0004_auth_hardening.sql` para roles y hashes versionados; se
  aplicó sólo a `file:local.db`.
- [x] Eliminar DDL de las clases `Model`; el esquema sólo cambia mediante migraciones explícitas.
- [x] Regenerar `local.db` desde migraciones; la copia legacy quedó en `.backups/`.
- [x] Probar las migraciones sobre una base vacía SQLite y verificar la base remota.
- [x] Crear `buildear-db-staging` desde producción y verificar por lectura su
  baseline `0001`/`0002`.
- [x] Aplicar y verificar `0003`/`0004` en staging mediante el runner.
- [x] Mantener `ON DELETE NO ACTION` y las unicidades actuales para evitar reconstrucciones destructivas.
- [ ] Implementar y probar actualización automática de timestamps desde el código.

Entregable: esquema reproducible local/remoto.
Gate: la misma suite pasa en SQLite local y Turso staging.

### Fase 3 — Seguridad y bugs bloqueantes

- [x] AUTH-001: DTOs públicos y queries sin hashes/salts.
- [x] Implementar la base de AUTH-002 con sesiones opacas revocables.
- [x] Documentar la estrategia de AUTH-002 en el ADR 0001.
- [x] AUTH-003: completar scrypt versionado y rehash progresivo compatible con
  PBKDF2.
- [x] AUTH-004: retirar callback, Passport y tipos OAuth/sesión huérfanos.
- [x] BUG-001: corregir tabla/modelo de mensajes.
- [x] BUG-002: corregir actualización y columnas de modelos.
- [x] BUG-003: separar cambio de contraseña.
- [x] Proteger recursos por usuario y escrituras del catálogo mediante roles
  persistentes.

Entregable: API sin filtrado de secretos y con propiedad de recursos aplicada.
Gate: tests `401`, `403`, no exposición de credenciales y regresiones críticas verdes.

### Fase 4 — OpenAI y seguridad de construcción

- [x] Crear `OpenAIService` inyectable y mocks.
- [x] Migrar guías a `responses.parse` con `guideSchema`.
- [x] Migrar chat a `responses.create` con contexto local autorizado y acotado.
- [x] Escribir metadata y uso en `ai_generations`.
- [x] Implementar prompts versionados, refusals, timeouts y retries acotados.
- [x] Verificar que la credencial local llega al proveedor y que el `429` por
  cuota se normaliza sin exponer secretos.
- [x] Completar un smoke real de chat y guía estructurada con metadata de uso.
- [x] Completar registro, login, chat y guía por HTTP contra staging y verificar
  las filas de `ai_generations` por lectura independiente.
- [ ] Crear evals por categoría, experiencia y riesgo constructivo.
- [ ] Ejecutar canary con límites de gasto.
- [x] Retirar Assistant ID, Threads, Runs y Chat Completions.

Entregable: integración Responses medible y auditable.
Gate: Structured Outputs válidos, evals aprobadas y rollback probado.

### Fase 5 — Contrato y modernización

- [x] Versionar endpoints bajo `/api/v1` preservando rutas legacy con headers
  de deprecación.
- [ ] Normalizar códigos HTTP y errores.
- [x] Migrar Express 5 y sus tipos.
- [x] Migrar Zod 4 y formato de errores.
- [x] Migrar a TypeScript 6; TypeScript 7 espera soporte del linter.
- [ ] Separar servicios, casos de uso y repositorios donde reduzca riesgo.

Entregable: contrato estable y toolchain actual.
Gate: contract tests, lint, typecheck, build y audit verdes.

### Fase 6 — Media y preparación productiva

- [x] Implementar carga, validación y ciclo de vida básico del modelo 3D.
- [ ] Completar lifecycle de imágenes de perfil y reintentos de limpieza.
- [x] Completar headers defensivos; CORS, uploads de modelos y rate limits
  tienen baseline.
- [x] Incorporar health checks y shutdown.
- [ ] Incorporar logs estructurados y métricas operativas.
- [ ] Ejecutar pruebas de carga y fallos de proveedores.
- [ ] Completar README, OpenAPI, ADRs y runbook de rollback.

Entregable: release candidata para producción.
Gate: staging estable, observabilidad activa y simulación de rollback exitosa.

## Definición de terminado para el programa completo

- Una instalación limpia crea y migra la base sin pasos manuales ocultos.
- La CI pasa format, lint, typecheck, tests, build, audit y migraciones.
- No se exponen secretos ni recursos entre usuarios.
- OpenAI usa Responses API y las guías se validan estructuralmente.
- El catálogo almacena imágenes y recursos 3D válidos.
- Todos los endpoints tienen contratos y estados HTTP consistentes.
- Existe un entorno staging con métricas, límites de gasto y rollback probado.
