# Release Notes - FPHM Overlay and Mock Profile UX

Date: 2026-03-29
Branch: codex/release-fphm-step7

## Scope Delivered

- Added FPHM reasoning artifacts for agent usage and repository mapping:
  - `FPHM_AGENT_SKILL.md`
  - `FPHM_NCO_MAPPING.md`
  - `CTO_PROMPT_PACK.md` (FPHM overlay section)
- Upgraded Step 7 recommendation layer in `simulation.js`:
  - District archetype classification
  - Bottleneck classification cards (PP and Clinical)
  - Intervention portfolio cards (PP and Clinical)
  - Wording split between `FPHM Overlay Summary` and `Indicator-Driven Recommendation`
- Improved mobile navigation behavior in `simulation.css` for end-to-end step traversal.
- Improved Mock Profile UX:
  - Auto preload when changing district profile inputs (`amphur_code`, `hospital_level`, `template_hospital`)
  - Better visual spacing and readability in profile status area
  - Extra top spacing above `Mock Profile Loader`
- Improved local launcher resiliency in `run_simulator.bat`:
  - Reuse running API/Web services when healthy
  - Keep port conflict fail-fast behavior for non-healthy listeners

## Validation Summary

- `node --check simulation.js` passed.
- Browser QA artifacts generated for Step 7 desktop/mobile and mock profile auto-load flow:
  - `output/playwright/step7-desktop-clickthrough.json`
  - `output/playwright/step7-mobile-tapthrough.json`
  - `output/playwright/mock-profile-autoload.json`
- Local health checks validated when launcher is executed:
  - `http://127.0.0.1:8765/api/overview` -> 200
  - `http://127.0.0.1:8766/simulation.html` -> 200

## Explicitly Excluded From Release Commit

- Debug artifacts and screenshots under `output/`, `output_step*.png`, and ad-hoc debug JSON files.
- Temporary files such as `_tmp_snippet.txt`.
- Any unrelated working tree changes outside the files listed in this release.

