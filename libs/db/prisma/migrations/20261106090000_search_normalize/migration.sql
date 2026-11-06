-- Search that ignores Arabic diacritics and letter variants (BR-USR-6).
-- Keep in step with `normalizeSearch` in libs/shared/src/lib/search.ts.
CREATE FUNCTION search_normalize(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT btrim(lower(translate(
    regexp_replace(t, '[ً-ٰٟـ]', '', 'g'),
    'أإآٱىیةؤئک٠١٢٣٤٥٦٧٨٩',
    'ااااييهويك0123456789'
  )))
$$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "nameSearch" TEXT NOT NULL DEFAULT '';

CREATE FUNCTION user_name_search() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nameSearch" := search_normalize(NEW.name);
  RETURN NEW;
END
$$;

CREATE TRIGGER "User_nameSearch"
BEFORE INSERT OR UPDATE OF name ON "User"
FOR EACH ROW EXECUTE FUNCTION user_name_search();

UPDATE "User" SET "nameSearch" = search_normalize(name);
