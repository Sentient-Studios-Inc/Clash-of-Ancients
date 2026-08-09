/*
# Add storage bucket for sprite preset images + paths column

## Purpose
The original sprite_presets table stored full base64 image data inside the
`frames` jsonb column. Multi-megabyte payloads made inserts hang and made the
preset list SELECT slow (the app appeared to "constantly load"). This migration
moves images into Supabase Storage and stores only public URLs + alignment
metadata in the DB, so both save and load are fast and light.

## Changes

### 1. New column on `sprite_presets`
- `paths` (text[], default '{}') — list of Storage object paths created for this
  preset, so they can be cleaned up when the preset is deleted. Non-destructive
  ALTER with a default; existing rows get an empty array.

### 2. New Storage bucket
- `sprite-presets` — public bucket holding the frame PNGs for presets.
  Objects are stored under `<preset-uuid>/<state>__<frameIdx>.png`.

### 3. Storage policies (on storage.objects)
- Public read of objects in the `sprite-presets` bucket (anon + authenticated).
- Anon + authenticated insert/upload into the bucket.
- Anon + authenticated delete from the bucket (used when removing a preset).

## Notes
1. The bucket is public so rendered sprites can be loaded via plain <img src>.
2. Single-tenant (no auth): policies use `TO anon, authenticated` like the
   sprite_presets table policies.
3. No data migration needed — existing presets (if any saved before the hang)
   are left in place; their `paths` defaults to an empty array.
*/

ALTER TABLE sprite_presets
  ADD COLUMN IF NOT EXISTS paths text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('sprite-presets', 'sprite-presets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_sprite_presets_bucket" ON storage.objects;
CREATE POLICY "anon_read_sprite_presets_bucket" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'sprite-presets');

DROP POLICY IF EXISTS "anon_write_sprite_presets_bucket" ON storage.objects;
CREATE POLICY "anon_write_sprite_presets_bucket" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'sprite-presets');

DROP POLICY IF EXISTS "anon_delete_sprite_presets_bucket" ON storage.objects;
CREATE POLICY "anon_delete_sprite_presets_bucket" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'sprite-presets');
