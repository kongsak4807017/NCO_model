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

**Never infer a missing numerator, denominator, indicator definition, or hospital value.**

## Data provenance rules

1. CMI / Service Plan is the source of truth for source values stored here.
2. Similar indicator names are not automatically merged.
3. A04 and DH0102 are both labelled AMI mortality in historical catalogs; the simulator hides A04 by default to avoid duplicate entry but does not migrate its value into DH0102 unless the definitions are proven equivalent.
4. A09/CI0101 and B01/CM0101 remain separate until numerator/denominator definitions are formally reconciled.
5. Every committed snapshot must pass `scripts/validate_cmi_snapshot.py`.
