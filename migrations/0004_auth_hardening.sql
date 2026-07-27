-- Roles persistentes y metadata versionada para actualizar hashes gradualmente.

ALTER TABLE users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

ALTER TABLE users
    ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha512';

ALTER TABLE users
    ADD COLUMN password_params TEXT NOT NULL
    DEFAULT '{"iterations":10000,"keyLength":64,"digest":"sha512"}';

CREATE INDEX idx_users_role ON users(role);
