# CMI 5-Year Acquisition Runbook (2565–2569)

## Objective

Build a reproducible five-year Health KPI dataset from the Region 1 CMI / Service Plan system and make it directly consumable by the NCO HR Blueprint.

The pipeline preserves **indicator code + year + hospital code + numerator + denominator + value + definition/provenance**. It does not infer missing source facts.

## Why collection is local/authorised

The CMI website is reachable from an ordinary browser, but tests from GitHub-hosted runners returned HTTP 403. Therefore:

- **GitHub Actions validates committed snapshots**
- **an authorised workstation collects source pages**
- **GitHub stores the normalized five-year dataset and audit manifests**

This avoids pretending a failed server-side scrape is valid source data.

## One-time setup on a workstation that can access CMI

```bash
git clone https://github.com/kongsak4807017/NCO_model.git
cd NCO_model

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements-cmi.txt
python -m playwright install chromium
```

## Step 1 — Discover the catalog and collect 5 years

Start visibly the first time so the operator can confirm the site loads normally:

```bash
python scripts/cmi_collect_browser.py --headed --years 2565,2566,2567,2568,2569
```

The collector will:

1. inspect the CMI report/service menus;
2. discover indicator codes from links/options;
3. merge them with the seed catalog;
4. open each indicator;
5. select each available fiscal year;
6. save the rendered source page under `data/cmi/raw/<year>/<code>.html`;
7. write a SHA-256 and source URL sidecar for audit.

A missing year is recorded as missing; it is never fabricated.

## Step 2 — Normalize all raw pages

```bash
python scripts/normalize_cmi_archive.py
```

Outputs:

- `data/cmi/normalized/2565.json` … `2569.json`
- `data/cmi/manifests/completeness.json`
- `data/cmi/manifests/source_manifest.json`
- `output/cmi_5y/health_kpi_records.json`
- `output/cmi_5y/health_kpi_records.csv`

## Step 3 — Validate

```bash
python scripts/validate_cmi_snapshot.py
```

Validation checks:

- duplicate hospital/indicator/year keys;
- five-digit hospital codes;
- source URL and source SHA-256;
- five-year range;
- missing measurable values;
- numerator/denominator/value arithmetic where the unit permits verification.

## Step 4 — Review completeness

Open:

`data/cmi/manifests/completeness.json`

The goal is not blindly “100%”. An indicator introduced in 2568 should be recorded as not available in 2565–2567 rather than inventing history. After the first collection, the catalog should be reviewed to add:

- `active_from`
- `active_to`
- definition version
- unit
- numerator definition
- denominator definition

Then completeness can distinguish **not-yet-active** from **missing extraction**.

## Step 5 — Commit the validated snapshot

Commit the catalog, normalized files, manifests, and merged output. Raw HTML may also be committed while repository size remains practical. If the raw archive grows too large, retain its SHA-256 manifest and move raw files to an approved versioned archive/Release.

## Operational refresh

For closed historical years 2565–2569, freeze a tagged snapshot after data-owner validation, for example:

`CMI_REGION1_5Y_v1.0_2565-2569`

Future refreshes should create a new version instead of silently overwriting the evidence used for a published HR analysis.

## Data governance

- CMI values are Health Outcome/Service context; they do not enter WISN FTE directly.
- Indicator names alone are not enough to merge codes.
- A04 and DH0102 both carry AMI mortality labels in historical catalogs. The UI hides A04 by default to avoid duplicate entry, but values are not migrated between them until definitions are reconciled.
- Preserve numerator/denominator whenever available.
- Hospital code is the preferred join key; hospital name is display text, not the primary key.
