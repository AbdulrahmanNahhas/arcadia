-- The audience constraint is already installed by the hand-curated 0008 data
-- migration. This no-op keeps Drizzle's generated snapshot synchronized without
-- rebuilding `terms` a second time and cascading through `work_terms`.
SELECT 1;
