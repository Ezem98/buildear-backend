# Migraciones de base de datos

Las migraciones se aplican en orden lexicográfico y se registran en
`schema_migrations` únicamente después de completar todas sus sentencias.
El runner valida el SHA-256 de cada archivo aplicado y aborta si el nombre,
versión o checksum difieren del registro.

## Comandos

```powershell
npm run db:migrate
npm run db:migrate:verify
```

Ambos comandos usan `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` cuando están
definidos; sin esas variables operan sobre `file:local.db`. `db:migrate` aplica
únicamente archivos pendientes dentro de una transacción por migración.
`db:migrate:verify` no aplica DDL: comprueba historial, checksums,
`integrity_check` y `foreign_key_check`.

Las conexiones `file:` activan y comprueban `PRAGMA foreign_keys = ON` al
inicializarse.

## Estado remoto

- `0001_remote_baseline.sql`: representa el esquema de `buildear-db` verificado
  antes de completar la metadata de OpenAI.
- `0002_openai_responses_metadata.sql`: agrega las columnas requeridas para la
  migración a Responses API.
- `0003_auth_sessions.sql`: agrega sesiones opacas revocables y su índice; fue
  verificada localmente, pero todavía no se aplicó a Turso.
- `0004_auth_hardening.sql`: agrega `users.role` y metadata versionada de
  contraseñas para migrar PBKDF2 a scrypt en el próximo login válido; fue
  verificada localmente, pero todavía no se aplicó a Turso.
- `0001` y `0002` fueron aplicadas a `buildear-db` y registradas el
  2026-07-27.
- Antes del DDL se creó la rama de respaldo
  `buildear-db-pre-metadata-20260727`.

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
