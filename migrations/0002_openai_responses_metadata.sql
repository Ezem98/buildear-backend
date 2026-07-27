-- Metadata necesaria para migrar la integración de OpenAI a Responses API.
-- Las columnas son nullable para conservar compatibilidad con registros legacy.

ALTER TABLE models ADD COLUMN model_public_id TEXT;
ALTER TABLE models ADD COLUMN image_public_id TEXT;
ALTER TABLE models ADD COLUMN model_format TEXT;
ALTER TABLE models ADD COLUMN model_size_bytes INTEGER;

ALTER TABLE user_models ADD COLUMN openai_response_id TEXT;
ALTER TABLE user_models ADD COLUMN openai_model TEXT;
ALTER TABLE user_models ADD COLUMN prompt_version TEXT;
ALTER TABLE user_models ADD COLUMN generated_at TIMESTAMP;

ALTER TABLE conversations ADD COLUMN title TEXT;
ALTER TABLE conversations ADD COLUMN summary TEXT;

ALTER TABLE conversation_messages
    ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE conversation_messages ADD COLUMN openai_response_id TEXT;
ALTER TABLE conversation_messages ADD COLUMN input_tokens INTEGER;
ALTER TABLE conversation_messages ADD COLUMN output_tokens INTEGER;
