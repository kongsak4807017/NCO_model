# CMI → HOSxP Extraction Specification

## Core principle

The **CMI / Service Plan definition is the standard**. HOSxP is the local data source used to reproduce that standard.

For every indicator, keep three states separate:

1. **Definition Ready** — numerator, denominator, formula and unit are known from CMI.
2. **HOSxP Mapping Ready** — the hospital has mapped logical concepts to its physical HOSxP/HOSxP XE tables/fields.
3. **Observed Data Ready** — the requested fiscal-year aggregate has actually been calculated and verified.

An indicator can therefore be Definition Ready even if 2565 or another year has no value.

## One mapping per hospital/version

Use `data/cmi/hosxp_mapping_template.json` and complete the physical source once for the hospital.

Examples of logical concepts:

| Logical concept | Used for |
|---|---|
| VN | OPD/ER encounter |
| AN | IPD admission |
| diagnosis / ICD-10 | disease cohort |
| procedure + datetime | surgery/procedure and timeliness |
| discharge/death status | mortality |
| admit/discharge datetime | LOS |
| age/DOB | pediatric/elderly criteria |
| DRG / AdjRW | CMI |
| charge amount | average treatment charge |

Common HOSxP installations may expose these concepts through tables/views such as `ovst`, `vn_stat`, `ipt`, `an_stat`, `iptdiag`, `iptoprt`, and `opitemrece`, but those names are **examples only**. HOSxP XE/version/site customizations must be verified locally.

## Standard query patterns

### Percentage

CMI publishes:

`numerator / denominator × 100`

Logical SQL pattern:

```sql
WITH denominator AS (
  SELECT DISTINCT <case_key>
  FROM <mapped_hosxp_sources>
  WHERE <CMI denominator criteria>
    AND <fiscal-year criteria>
),
numerator AS (
  SELECT DISTINCT <case_key>
  FROM denominator
  WHERE <additional CMI numerator criteria>
)
SELECT
  COUNT(*) AS numerator,
  (SELECT COUNT(*) FROM denominator) AS denominator,
  COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM denominator), 0) AS value
FROM numerator;
```

### Mortality

Denominator = the CMI-defined disease/service cohort.

Numerator = denominator cohort with the CMI-defined death/discharge outcome.

Never use all hospital deaths as the numerator unless CMI defines it that way.

### Average LOS

```
Σ LOS days of eligible cases / number of eligible cases
```

The cohort definition must come from CMI. LOS can come from a verified HIS LOS field or be derived consistently from admit/discharge datetime.

### Procedure within a time target

Example logic:

```
numerator = eligible cases satisfying procedure_datetime - admit_datetime <= threshold
denominator = all eligible procedure cases
value = numerator / denominator × 100
```

Any additional CMI condition (for example LOS ≤5 days) is part of the numerator and must not be dropped.

### CMI / Average AdjRW

```
Σ AdjRW / number of eligible discharged cases
```

### Average charge

```
Σ eligible treatment charge / number of eligible cases
```

Use the same charge basis used by CMI; do not mix billed charge, reimbursed amount and cost.

## QA requirements

For every generated aggregate keep:

- hospital code;
- fiscal year;
- indicator code;
- numerator;
- denominator;
- calculated value;
- source definition version;
- HOSxP mapping version;
- extraction timestamp.

Before publishing, compare at least one overlapping year with the CMI web result:

```
local numerator == CMI numerator
local denominator == CMI denominator
local value ≈ CMI value
```

If they differ, the result stays `Reviewed/Draft`; do not change the CMI definition merely to make the numbers match.

## Repository privacy boundary

Do **not** upload HN, CID, VN-level clinical rows, names, dates of birth, or patient-level extracts to this repository.

Only aggregate KPI results, definitions, mapping metadata, and audit hashes belong in the NCO data layer.
