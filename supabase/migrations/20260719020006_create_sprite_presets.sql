/*
# Create sprite_presets table (single-tenant, no auth)

## Purpose
Stores named, reusable sprite animation configurations ("presets") so users can
build a library of tuned frame sets after uploading + editing in the frame
editor. Each preset captures the full StateFrameMap (base64 data URLs + per-
frame alignment fields + durations) for one slot (left/right).

## New Tables
- `sprite_presets`
  - `id` (uuid, primary key)
  - `title` (text, not null) — user-chosen name for the preset
  - `slot` (text, not null) — 'cyclops' (left) or 'medusa' (right)
  - `frames` (jsonb, not null) — the full StateFrameMap payload
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `sprite_presets`.
- Single-tenant app (no sign-in screen), so CRUD is open to anon +
  authenticated. The data is intentionally shared/public across the app.
- Four separate policies (select/insert/update/delete), each TO anon, authenticated.

## Notes
1. `frames` is stored as jsonb so the entire frame config (including base64
   image data) persists in one column and round-trips without transformation.
2. An index on (slot, created_at) keeps the preset list ordered per slot.
*/

CREATE TABLE IF NOT EXISTS sprite_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('cyclops', 'medusa')),
  frames jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sprite_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sprite_presets" ON sprite_presets;
CREATE POLICY "anon_select_sprite_presets" ON sprite_presets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sprite_presets" ON sprite_presets;
CREATE POLICY "anon_insert_sprite_presets" ON sprite_presets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sprite_presets" ON sprite_presets;
CREATE POLICY "anon_update_sprite_presets" ON sprite_presets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sprite_presets" ON sprite_presets;
CREATE POLICY "anon_delete_sprite_presets" ON sprite_presets FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS sprite_presets_slot_created_idx
  ON sprite_presets (slot, created_at DESC);
