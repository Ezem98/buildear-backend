-- Refresh tokens opacos, rotativos y agrupados por familia de sesión.

ALTER TABLE auth_sessions ADD COLUMN refresh_token_hash TEXT;
ALTER TABLE auth_sessions ADD COLUMN refresh_expires_at TIMESTAMP;
ALTER TABLE auth_sessions ADD COLUMN session_family TEXT;
ALTER TABLE auth_sessions ADD COLUMN rotated_at TIMESTAMP;

CREATE UNIQUE INDEX idx_auth_sessions_refresh_token
    ON auth_sessions(refresh_token_hash)
    WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX idx_auth_sessions_family
    ON auth_sessions(session_family);
