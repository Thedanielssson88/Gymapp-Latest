-- Lägg till barbellWeight och dumbbellWeight kolumner till zones-tabellen

ALTER TABLE zones
ADD COLUMN IF NOT EXISTS "barbellWeight" DECIMAL(5,2) DEFAULT 20.0,
ADD COLUMN IF NOT EXISTS "dumbbellWeight" DECIMAL(5,2) DEFAULT 1.0;

-- Lägg till kommentarer för att förklara kolumnerna
COMMENT ON COLUMN zones."barbellWeight" IS 'Vikt på skivstång i kg (utan plattor)';
COMMENT ON COLUMN zones."dumbbellWeight" IS 'Vikt på hantel i kg (utan plattor)';
