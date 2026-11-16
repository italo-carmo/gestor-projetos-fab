ALTER TABLE "CpcComplaintCase" ADD COLUMN "victims" JSONB;

UPDATE "CpcComplaintCase"
SET "victims" = jsonb_build_array(jsonb_build_object(
  'id', 'victim-' || "id",
  'victimRank', "victimRank",
  'victimGender', "victimGender"::text,
  'victimAgeRange', "victimAgeRange",
  'incidentFrequency', "incidentFrequency",
  'hierarchicalFunctionalRelation', "hierarchicalFunctionalRelation",
  'occurrenceForms', CASE
    WHEN cardinality("occurrenceForms") > 0 THEN to_jsonb("occurrenceForms")
    WHEN NULLIF(trim("occurrenceForm"), '') IS NOT NULL THEN jsonb_build_array("occurrenceForm")
    ELSE '[]'::jsonb
  END,
  'isNotifier', "victimIsNotifier"
));
