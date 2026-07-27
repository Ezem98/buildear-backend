# Migraciones de base de datos

Las migraciones se aplican en orden lexicográfico y se registran en
`schema_migrations` únicamente después de completar todas sus sentencias.
El runner valida el SHA-256 de cada archivo aplicado y aborta si el nombre,
versión o checksum difieren del registro.

## Comandos

```powershell
npm run db:migrate
npm run db:migrate:verify
npm run db:migrate:staging
npm run db:migrate:staging:verify
```

Ambos comandos usan `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` cuando están
definidos; sin esas variables operan sobre `file:local.db`. `db:migrate` aplica
únicamente archivos pendientes dentro de una transacción por migración.
`db:migrate:verify` no aplica DDL: comprueba historial, checksums,
`integrity_check` y `foreign_key_check`.

Las conexiones `file:` activan y comprueban `PRAGMA foreign_keys = ON` al
inicializarse.

Los comandos `:staging` cargan `.env.staging` mediante Node 26. Ese archivo
está ignorado por Git y contiene la URL de `buildear-db-staging`; antes de
ejecutarlos se debe completar localmente `TURSO_AUTH_TOKEN`. El template
versionado es `.env.staging.example`.

## Estado remoto

- `0001_remote_baseline.sql`: representa el esquema de `buildear-db` verificado
  antes de completar la metadata de OpenAI.
- `0002_openai_responses_metadata.sql`: agrega las columnas requeridas para la
  migración a Responses API.
- `0003_auth_sessions.sql`: agrega sesiones opacas revocables y su índice; fue
  aplicada y verificada localmente y en `buildear-db-staging`.
- `0004_auth_hardening.sql`: agrega `users.role` y metadata versionada de
  contraseñas para migrar PBKDF2 a scrypt en el próximo login válido; fue
  aplicada y verificada localmente y en `buildear-db-staging`.
- `0001` y `0002` fueron aplicadas a `buildear-db` y registradas el
  2026-07-27.
- Antes del DDL se creó la rama de respaldo
  `buildear-db-pre-metadata-20260727`.
- El 2026-07-27 se creó `buildear-db-staging` desde `buildear-db`. Una
  verificación de sólo lectura confirmó `0001`/`0002`, 9 tablas, 8 índices y
  5 categorías.
- `0003`/`0004` fueron aplicadas a staging mediante
  `npm run db:migrate:staging`. El runner y una lectura independiente
  confirmaron cuatro checksums, 10 tablas, 10 índices, integridad `ok` y cero
  violaciones FK.
- Producción permanece en `0001`/`0002`; no debe promoverse hasta completar
  pruebas funcionales y un plan de rollback.

## Base local

`local.db` fue actualizada hasta `0004`. La base legacy, que contenía
tres usuarios sin `password_salt`, se conservó en
`.backups/local.legacy-20260727.db` y no debe versionarse.

No se deben editar migraciones ya registradas. Todo cambio de esquema nuevo debe
agregarse en un archivo SQL con la siguiente versión.

El test `tests/migrations.test.ts` cubre una base `file:` vacía, la
idempotencia, las diez tablas, diez índices, cinco categorías, las 14 columnas
de metadata, sesiones, roles, metadata de contraseñas, rechazo de filas
huérfanas, detección de checksum modificado y rollback de una migración fallida.
