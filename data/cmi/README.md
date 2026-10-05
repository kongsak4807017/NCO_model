# CMI / Service Plan 5-Year Data Lake

This directory is the authoritative **source snapshot layer** for Health KPI History in the NCO HR Blueprint.

## Target window

- 2565
- 2566
- 2567
- 2568
- 2569

Year 2570 is treated as YTD and must not be mixed into the closed five-year historical series.

## Layout

```text
data/cmi/
  catalog/
    indicators.json
  raw/
    README.md
    <YYYY>/<indicator>.html           # optional source archive from authorised collector
  normalized/
    2565.json
    2566.json
    2567.json
    2568.json
    2569.json
  manifests/
    completeness.json
    source_manifest.json
```

The simulator consumes the merged file:

```text
output/cmi_5y/health_kpi_records.json
```

## Required row schema

Each normalized row preserves:

- fiscal year
- indicator code and indicator name
- province
- hospital code (5 digits)
- hospital name
- service level when available
- numerator
- denominator
- value
- unit
- source URL
- source page hash
- collection timestamp
- definition text / definition hash when available

**Do not invent a missing hospital value or clinical criterion.** Numerator/denominator/formula metadata may be derived from the CMI source page table headings because those headings are the published operational definition used by the reporting system; the registry records whether the definition is verified or source-page-derived.

## Data provenance rules

1. CMI / Service Plan is the source of truth for source values stored here.
2. Similar indicator names are not automatically merged.
3. A04 and DH0102 are both labelled AMI mortality in historical catalogs; the simulator hides A04 by default to avoid duplicate entry but does not migrate its value into DH0102 unless the definitions are proven equivalent.
4. A09/CI0101 and B01/CM0101 remain separate until numerator/denominator definitions are formally reconciled.
5. Every committed snapshot must pass `scripts/validate_cmi_snapshot.py`.


## Definition layer

`data/cmi/catalog/definitions.json` is independent from the five-year observed-value snapshot.

This means:

- a KPI can be **Definition Ready** even when one or more fiscal years have no observed value;
- CMI numerator/denominator/output labels define the calculation logic;
- the same logical extraction rule can be implemented against each hospital's HOSxP/HIS;
- HOSxP physical table/field names remain a local mapping concern and must not alter the CMI definition.

Use:

```bash
python scripts/build_cmi_definition_registry.py
```

after raw CMI pages are collected. The resulting registry is exported into the Excel template as `CMI_KPI_Definitions`.
