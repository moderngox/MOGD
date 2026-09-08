-- trainingContext moved from a single value to a multi-select (assessment
-- step 6 now lets a user pick more than one training location). The column
-- was already loosely-typed TEXT, so drizzle-kit sees no DDL change — only
-- existing rows storing a bare string (e.g. `gym`) need rewriting into a
-- one-element JSON array so the app's new `mode: "json"` read matches what
-- it actually finds. Guarded so re-running is a no-op on already-migrated rows.
UPDATE `training_profile` SET `trainingContext` = '["' || `trainingContext` || '"]' WHERE `trainingContext` NOT LIKE '[%';
