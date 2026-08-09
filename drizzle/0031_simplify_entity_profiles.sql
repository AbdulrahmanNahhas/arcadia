-- Replace the free-form source/identity records with the entity profile's canonical metadata.
-- Existing URLs and well-known identifiers are retained before legacy rows are removed.
UPDATE entities
SET metadata = json_set(
  metadata,
  '$.primaryUrl', COALESCE(
    json_extract(metadata, '$.primaryUrl'),
    json_extract(metadata, '$.sourceUrl'),
    (SELECT url FROM entity_external_identities WHERE entity_id = entities.id AND url IS NOT NULL LIMIT 1)
  ),
  '$.anilistId', COALESCE(
    json_extract(metadata, '$.anilistId'),
    (SELECT CAST(external_id AS INTEGER) FROM entity_external_identities WHERE entity_id = entities.id AND lower(provider) = 'anilist' AND external_id GLOB '[0-9]*' LIMIT 1)
  ),
  '$.imdbId', COALESCE(
    json_extract(metadata, '$.imdbId'),
    (SELECT external_id FROM entity_external_identities WHERE entity_id = entities.id AND lower(provider) = 'imdb' LIMIT 1)
  ),
  '$.wikipediaUrl', COALESCE(
    json_extract(metadata, '$.wikipediaUrl'),
    (SELECT url FROM entity_external_identities WHERE entity_id = entities.id AND lower(provider) = 'wikipedia' AND url IS NOT NULL LIMIT 1)
  )
);
