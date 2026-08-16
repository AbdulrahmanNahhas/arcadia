ALTER TABLE "roles" ADD CONSTRAINT "roles_typed_slug_check"
CHECK ("slug" IN (
  'creator', 'original_author', 'director', 'writer', 'producer',
  'executive_producer', 'creative_producer', 'character_designer',
  'art_director', 'composer', 'animation_studio', 'production_company',
  'distributor', 'publisher'
));
