# Release Notes: HR Blueprint Dashboard (Region 1)

Release date: 2026-05-04

## Highlights

- Added a study-ready HR Blueprint report for Health Region 1 with provincial baselines and computed gap-to-targets (5-year floor, 10-year stretch).
- Added a reproducible generator script to recompute provincial baseline from the real data already in the repo (`hr_blueprint.db` + HDC population table).
- Improved mock workflow UX in the simulator (mock status badge, mock guide slots per step, run-history card placeholder) and ensured the Mock Profile Loader card has clear spacing from hospital cards.
- Updated indicator references so Stroke/rtPA logic is consistent across standards and recommendation guide (`DN0142D`).
- Cleaned repo hygiene to avoid shipping local artifacts (pycache, OMX state, screenshots) and removed tracked `__pycache__/*.pyc` files.

## What Changed (User-Facing)

- Step 0: Mock Profile Loader appears with clearer separation from the selected hospital card.
- Steps 0-7: Mock guide slot containers are present so mock guidance can render consistently.
- Step 7: Placeholder card is available for analysis run history display.

## What Changed (Data/Methods)

- Region 1 provincial baseline is generated from:
  - Population: `health_metrics_analysis_report.md` (HDC 2569 table)
  - Workforce/vacancy/retirement: `hr_blueprint.db`

Artifacts:
- `HR_Blueprint_Study_Report_Region1_2026-05-04.md`
- `output/hr_blueprint_provincial_baseline_region1.json`
- `scripts/generate_region1_provincial_hr_baseline.py`

## Known Limitations

- Targets are benchmarked against Region 1 median/P75 per 10,000 population as a direction-setting approach; final FTE standards should be recalibrated after integrating real workload/service flow data.
- Local simulator relies on the local Python environment; if packages are missing, `run_simulator.bat` will attempt to install them.

