# ADR 0002: rotación de refresh tokens

- Estado: aceptada.
- Fecha: 3 de septiembre de 2026.

## Contexto

Las sesiones necesitan mantener autenticados a los usuarios activos sin guardar
credenciales de larga duración en texto plano. La rotación también debe tolerar
requests en vuelo sin debilitar la detección de reutilización del refresh token.

## Decisión

- Emitir access tokens opacos con una duración predeterminada de una hora.
- Emitir refresh tokens opacos, almacenar sólo su SHA-256 y rotarlos en cada uso.
- Renovar el vencimiento del refresh token por siete días desde cada rotación.
  Por lo tanto, el vencimiento es deslizante mientras la aplicación siga activa.
- Marcar el refresh anterior como rotado inmediatamente y rechazar cualquier
  intento posterior de usarlo.
- Mantener válido durante 30 segundos el access token asociado al refresh recién
  rotado para tolerar requests en vuelo. El período se configura mediante
  `AUTH_ACCESS_ROTATION_GRACE_SECONDS` y puede desactivarse con `0`.
- Ante la reutilización de un refresh token, revocar inmediatamente toda la
  familia de sesión, incluidos los access y refresh tokens más recientes.

## Consecuencias

- El uso normal de la aplicación extiende la sesión sin exigir un nuevo login.
- Dos requests concurrentes pueden completar con el access anterior durante la
  ventana de gracia, pero ese token deja de funcionar al terminarla.
- La ventana de gracia no permite volver a usar el refresh token anterior.
- Logout, cambio de contraseña y detección de reutilización conservan revocación
  inmediata y no aplican el período de gracia.
