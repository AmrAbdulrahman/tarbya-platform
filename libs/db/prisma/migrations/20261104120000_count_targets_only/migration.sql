-- Only counts take a target; percentages are always out of 100 (BR-TRK-1).
UPDATE "Trackable" SET "target" = NULL WHERE "type" <> 'COUNT' AND "target" IS NOT NULL;
UPDATE "TrackableTemplate" SET "target" = NULL WHERE "type" <> 'COUNT' AND "target" IS NOT NULL;
