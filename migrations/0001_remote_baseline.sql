-- Baseline equivalente al esquema remoto verificado en buildear-db.
-- Esta migración es segura sobre una base vacía y no recrea tablas existentes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    image TEXT,
    experience_level INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name TEXT NOT NULL DEFAULT '',
    surname TEXT NOT NULL DEFAULT '',
    completed_profile INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    model_data TEXT NOT NULL,
    model_image TEXT NOT NULL,
    difficulty_rating INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position TEXT NOT NULL DEFAULT '',
    height INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    model_checksum TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS user_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    current_step INTEGER DEFAULT 0,
    guide TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generation_status TEXT,
    UNIQUE(user_id, model_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, model_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP,
    UNIQUE(id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    sender TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_code TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS ai_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    feature TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL,
    response_id TEXT,
    prompt_version TEXT NOT NULL,
    status TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    error_code TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_models_category
    ON models(category_id);
CREATE INDEX IF NOT EXISTS idx_user_models_user
    ON user_models(user_id);
CREATE INDEX IF NOT EXISTS idx_user_models_model
    ON user_models(model_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user
    ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
    ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_created
    ON ai_generations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generations_feature
    ON ai_generations(feature);

INSERT INTO categories (id, name)
SELECT 1, 'roof'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 1 OR name = 'roof');

INSERT INTO categories (id, name)
SELECT 2, 'floor'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 2 OR name = 'floor');

INSERT INTO categories (id, name)
SELECT 3, 'wall'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 3 OR name = 'wall');

INSERT INTO categories (id, name)
SELECT 4, 'opening'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 4 OR name = 'opening');

INSERT INTO categories (id, name)
SELECT 5, 'foundation'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 5 OR name = 'foundation');
