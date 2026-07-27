# ADR 0001: autenticación y autorización

- Estado: aceptada para el baseline de modernización.
- Fecha: 27 de julio de 2026.

## Contexto

El login legacy sólo validaba usuario y contraseña. No existían sesiones,
revocación, expiración, ownership ni roles. Las contraseñas usaban PBKDF2
SHA-512 con 10.000 iteraciones sin registrar algoritmo o parámetros.

## Decisión

- Usar tokens bearer opacos aleatorios de 256 bits.
- Persistir únicamente SHA-256 del token en `auth_sessions`.
- Mantener sesiones de corta duración, revocables individualmente o por
  usuario.
- No emitir refresh tokens en el baseline: una sesión vencida requiere un
  nuevo login. Cualquier incorporación futura exige rotación, reutilización
  detectada y un ADR separado.
- Resolver identidad y rol desde la base en cada request autenticado.
- Persistir `users.role` con valores `user` o `admin`; el registro público
  siempre conserva el default `user`.
- Aplicar ownership en los recursos del usuario y exigir `admin` para escribir
  el catálogo global.
- Generar contraseñas nuevas mediante `crypto.scrypt` asíncrono con parámetros
  versionados.
- Mantener verificación de PBKDF2 legacy y rehashear con scrypt después del
  próximo login válido.

## Consecuencias

- La revocación es inmediata y no requiere guardar el bearer token en texto.
- Cada request autenticado consulta la sesión y el usuario; se prioriza
  revocación/rol inmediato sobre evitar esa lectura.
- El cambio de rol se realiza mediante una operación administrativa fuera del
  registro público.
- El rate limiting debe usar un almacenamiento compartido antes de escalar a
  múltiples instancias. El baseline usa límites en memoria para login,
  registro, cambio de contraseña y OpenAI.
- Una futura estrategia de refresh tokens requerirá otro ADR y migración.
