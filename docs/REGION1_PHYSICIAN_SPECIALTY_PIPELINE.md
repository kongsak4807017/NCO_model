# Region 1 physician specialty overview — source-first HR extraction

## Why this was added

The original NCO Physician Specialty Mapping page only prepared manually-entered supply CSV and manual CheckMD result text, while HR Blueprint already defines physician source fields. This job extracts *existing* HR records in one read-only pass and produces a usable Region 1 hospital/province view. It does not need one CSV per doctor.

## Data source and interpretation

Use the existing local HR Blueprint database, not a new personnel repository. Two schema variants are supported:

- Raw HR source: hr_personnel; uses employee_id or name+surname for internal deduplication (name fallback is lower-quality), code5/pos_code5 and province_code for facility identity. Uses position_specialist_name/pay_position_specialist_name first, then highest_specialist_name/position_education_specialist_name/enrollment_specialist_name/fte_specialist_name only as **credential proxies**.
- Normalized source: assignment + position + organizational_unit; counts active physician assignments (position_name_th includes นายแพทย์), reads position_specialist_name. Can work even when person-name columns are not available.

The schema dictionary shows that personnel names, physician specialty position fields, and multiple credential fields exist in the source model. It does **not** establish whether these fields are populated correctly in the current private database. Names and IDs are used only in memory to deduplicate and never exported.

The label in a personnel position record is *not* proof of a Medical Council-certified physician credential. Multiple credentials also do not create multiple doctors. The script chooses a single primary position specialty per person and facility; conflicts and unknown labels are counted as unresolved. It never fabricates missing specialty data or assumes every doctor is one full FTE.

## Run using the authorized workstation (local database read-only)

From the repository directory:

    python -m unittest tests.test_region1_physician_specialties
    python scripts/build_region1_physician_specialties.py --db "C:\HR_blueprint\hr_blueprint_dashboard\hr_blueprint.db" --year 2569 --out output/region1_physician_specialty_PRIVATE.json

Open:

    physician_specialty_region1.html

Choose the generated JSON file. The dashboard runs entirely in the browser and shows aggregate counts by province and facility, and mapping gaps.

If the source database is at another location, use its actual read-authorized path in --db. Do not put the database, user names, employee IDs, license numbers or private aggregate file into the public GitHub repository. The source database is intentionally ignored by Git.

## Why official CheckMD is not silently batch-queried

Official search: https://checkmd.tmc.or.th/v3

CheckMD publicly supports checking a physician by name and seeing approved medical specialties, but an approved bulk/API connection has not been established for this project. Automatically scraping the search form or treating HR specialty labels as Medical Council-verified would overstate verification. A future authorized integration should store only verification status/provenance and an approved credential mapping on an access-controlled server. Never publish per-person matching results in GitHub Pages.

## Data fitness and caveats

- Total doctors: unique physician identifiers within a unit/province/region in the selected HR snapshot; without a reliable employee ID, name+surname fallback can collide.
- Mapped: recognizable specialty strings against the source catalog (no fuzzy mapping). Position-mapped and credential-proxy-mapped are separate counts.
- Unmapped, missing and conflict: must be reviewed by HR; these are not zero-demand or zero-staff positions.
- Provincial distinct doctors and the sum of hospital assignments are different measures when doctors rotate across facilities.
- FTE from real assignment/workload and CheckMD confirmation are separate downstream requirements. This snapshot alone does not establish approved Need FTE or staffing shortage.
- Small-cell aggregation may reveal individual clinicians in small hospitals. Private output is ignored from Git, and publication must be approved after governance and disclosure review.

## Release gate

This repository feature is a generator and a *private-view dashboard*. The public GitHub Pages page cannot connect to a local C: drive or a protected HR database. Therefore real facility/province specialty counts will appear only after an authorized source export or an internally deployed, access-controlled API has supplied the aggregate.

Do not claim completeness, accuracy percentage or regional coverage until the real HR snapshot has been loaded, reconciled and signed off.
