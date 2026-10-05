#!/usr/bin/env python3
"""Collect rendered CMI/Service Plan pages from an authorised browser session.

Run this on a Ministry/Region/Hospital workstation that can open:
https://cmi.maewanghospital.go.th/web/index.php

The script intentionally uses a real browser. GitHub-hosted runners currently receive
HTTP 403 from the source, so collection must occur from an authorised network/browser.

Output:
  data/cmi/raw/<year>/<indicator>.html
  data/cmi/raw/<year>/<indicator>.meta.json
  data/cmi/catalog/indicators.json

The collector never invents missing years or values.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

BASE = "https://cmi.maewanghospital.go.th/web/index.php"
CATALOG_PATH = Path("data/cmi/catalog/indicators.json")
RAW_DIR = Path("data/cmi/raw")
DEFAULT_YEARS = [2565, 2566, 2567, 2568, 2569]

ENTRY_URLS = [
    f"{BASE}?r=service%2Findex",
    f"{BASE}?r=report%2Fdrgindexreport",
    BASE,
]

CODE_RE = re.compile(r"^[A-Z]{1,4}\d{2,5}[A-Z0-9]*$", re.I)
YEAR_RE = re.compile(r"\b(25\d{2})\b")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def load_seed_catalog() -> dict:
    if not CATALOG_PATH.exists():
        return {"indicators": []}
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def source_url_for(code: str, family: str) -> str:
    if family == "service_plan":
        return f"{BASE}?{urlencode({'co_thip_new': code, 'r': 'service/index'})}"
    return f"{BASE}?{urlencode({'id': code, 'r': 'report/drgindexreport'})}"


def extract_code_from_url(url: str) -> tuple[str, str] | None:
    try:
        q = parse_qs(urlparse(url).query)
    except Exception:
        return None
    if q.get("co_thip_new"):
        code = q["co_thip_new"][0].strip().upper()
        return (code, "service_plan") if CODE_RE.match(code) else None
    if q.get("id"):
        code = q["id"][0].strip().upper()
        if CODE_RE.match(code):
            return code, "core_outcome"
    return None


async def discover_candidates(page) -> dict[str, dict]:
    found: dict[str, dict] = {}

    for entry in ENTRY_URLS:
        try:
            await page.goto(entry, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(1200)
        except Exception:
            continue

        anchors = await page.locator("a").evaluate_all(
            """els => els.map(a => ({href:a.href || '', text:(a.innerText || a.textContent || '').trim()}))"""
        )
        for item in anchors:
            parsed = extract_code_from_url(item.get("href", ""))
            if not parsed:
                continue
            code, family = parsed
            found.setdefault(code, {
                "code": code,
                "name": item.get("text") or code,
                "family": family,
                "source_url": item["href"],
                "discovered_from": entry,
            })

        # Some menus use <option value="CODE"> rather than links.
        selects = await page.locator("select").evaluate_all(
            """sels => sels.map(s => Array.from(s.options).map(o => ({value:o.value||'', text:(o.textContent||'').trim()}))).flat()"""
        )
        for item in selects:
            value = str(item.get("value") or "").strip().upper()
            if CODE_RE.match(value):
                found.setdefault(value, {
                    "code": value,
                    "name": item.get("text") or value,
                    "family": "service_plan",
                    "source_url": source_url_for(value, "service_plan"),
                    "discovered_from": entry,
                })

        html = await page.content()
        for code in re.findall(r"co_thip_new(?:=|%3D)([A-Z0-9]+)", html, flags=re.I):
            code = code.upper()
            if CODE_RE.match(code):
                found.setdefault(code, {
                    "code": code,
                    "name": code,
                    "family": "service_plan",
                    "source_url": source_url_for(code, "service_plan"),
                    "discovered_from": entry,
                })

    return found


async def find_year_select(page, target_years: list[int]):
    best = None
    best_score = 0
    selects = page.locator("select")
    for i in range(await selects.count()):
        sel = selects.nth(i)
        options = await sel.locator("option").evaluate_all(
            """opts => opts.map(o => ({value:o.value||'', text:(o.textContent||'').trim(), selected:o.selected}))"""
        )
        years = set()
        for option in options:
            match = YEAR_RE.search(f"{option.get('text','')} {option.get('value','')}")
            if match:
                years.add(int(match.group(1)))
        score = len(years.intersection(target_years))
        if score > best_score:
            best_score = score
            best = (i, options, years)
    return best


async def choose_year(page, select_index: int, options: list[dict], year: int) -> bool:
    selected_value = None
    for option in options:
        match = YEAR_RE.search(f"{option.get('text','')} {option.get('value','')}")
        if match and int(match.group(1)) == year:
            selected_value = option.get("value")
            break
    if selected_value is None:
        return False

    sel = page.locator("select").nth(select_index)
    before = page.url
    try:
        await sel.select_option(value=str(selected_value))
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except PlaywrightTimeoutError:
            pass
        await page.wait_for_timeout(800)
    except Exception:
        return False

    # If the site needs explicit form submission, do it once.
    selected_text = await sel.locator("option:checked").inner_text()
    if str(year) not in selected_text and page.url == before:
        try:
            await sel.evaluate("(el) => { el.dispatchEvent(new Event('change',{bubbles:true})); if(el.form) el.form.submit(); }")
            await page.wait_for_load_state("domcontentloaded", timeout=10000)
            await page.wait_for_timeout(800)
        except Exception:
            pass
    return True


async def collect_indicator(page, indicator: dict, years: list[int], raw_dir: Path) -> dict:
    code = indicator["code"]
    url = indicator.get("source_url") or source_url_for(code, indicator.get("family", "service_plan"))
    result = {"code": code, "source_url": url, "years": {}, "errors": []}

    # Definition metadata is collected independently from fiscal-year observations.
    # This makes numerator/denominator/formula metadata usable even if a historical
    # year is absent or the indicator was introduced later.
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1000)
        definition_html = await page.content()
        definition_text = await page.locator("body").inner_text()
        if not re.search(r"\b403\b|forbidden|access denied", definition_text, flags=re.I):
            definition_dir = raw_dir / "definitions"
            definition_dir.mkdir(parents=True, exist_ok=True)
            definition_path = definition_dir / f"{code}.html"
            definition_meta_path = definition_dir / f"{code}.meta.json"
            definition_path.write_text(definition_html, encoding="utf-8")
            definition_meta = {
                "schema_version": "nco-cmi-definition-source-v1",
                "indicator_code": code,
                "indicator_name": indicator.get("name") or code,
                "family": indicator.get("family"),
                "source_url": page.url,
                "source_url_requested": url,
                "collected_at": now_iso(),
                "sha256": sha256_text(definition_html),
            }
            definition_meta_path.write_text(json.dumps(definition_meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            result["definition"] = {"status": "saved", "file": str(definition_path), "sha256": definition_meta["sha256"]}
        else:
            result["definition"] = {"status": "access_denied"}
    except Exception as exc:
        result["definition"] = {"status": "error", "error": str(exc)}

    for year in years:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(1000)
            year_sel = await find_year_select(page, years)
            if year_sel:
                index, options, available_years = year_sel
                result["available_years"] = sorted(available_years)
                if year not in available_years:
                    result["years"][str(year)] = {"status": "year_not_available"}
                    continue
                ok = await choose_year(page, index, options, year)
                if not ok:
                    result["years"][str(year)] = {"status": "year_select_failed"}
                    continue

            html = await page.content()
            visible = await page.locator("body").inner_text()
            # Refuse obvious access-denied pages.
            if re.search(r"\b403\b|forbidden|access denied", visible, flags=re.I):
                result["years"][str(year)] = {"status": "access_denied"}
                continue

            year_dir = raw_dir / str(year)
            year_dir.mkdir(parents=True, exist_ok=True)
            html_path = year_dir / f"{code}.html"
            meta_path = year_dir / f"{code}.meta.json"
            html_path.write_text(html, encoding="utf-8")

            title = (await page.title()).strip()
            meta = {
                "schema_version": "nco-cmi-raw-page-v1",
                "indicator_code": code,
                "indicator_name": indicator.get("name") or code,
                "family": indicator.get("family"),
                "fiscal_year_requested": year,
                "page_title": title,
                "source_url": page.url,
                "source_url_requested": url,
                "collected_at": now_iso(),
                "sha256": sha256_text(html),
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            result["years"][str(year)] = {"status": "saved", "file": str(html_path), "sha256": meta["sha256"]}
        except Exception as exc:
            result["years"][str(year)] = {"status": "error", "error": str(exc)}
            result["errors"].append(f"{year}: {exc}")
    return result


async def main_async(args) -> int:
    years = [int(x) for x in args.years.split(",") if x.strip()]
    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not args.headed)
        context = await browser.new_context(locale="th-TH")
        page = await context.new_page()

        discovered = await discover_candidates(page)
        seed = load_seed_catalog()
        for item in seed.get("indicators", []):
            code = str(item.get("code") or "").upper()
            if not code:
                continue
            discovered.setdefault(code, {
                **item,
                "source_url": item.get("source_url") or source_url_for(code, item.get("family", "service_plan")),
                "discovered_from": "seed_catalog",
            })

        catalog = {
            "schema_version": "nco-cmi-indicator-catalog-v1",
            "source_system": "CMI / Service Plan Region 1",
            "source_base_url": BASE,
            "discovered_at": now_iso(),
            "discovery_status": "browser_discovered",
            "years_target": years,
            "indicators": sorted(discovered.values(), key=lambda x: x["code"]),
        }
        CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        total = len(catalog["indicators"])
        print(f"Discovered/seeded {total} indicators")
        failures = 0
        for idx, indicator in enumerate(catalog["indicators"], 1):
            print(f"[{idx}/{total}] {indicator['code']} {indicator.get('name','')}")
            result = await collect_indicator(page, indicator, years, raw_dir)
            if not any(v.get("status") == "saved" for v in result["years"].values()):
                failures += 1
            if args.pause_ms:
                await page.wait_for_timeout(args.pause_ms)

        await browser.close()

    print(f"Collection complete. Indicators with no saved year: {failures}/{total}")
    return 0 if failures < total else 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="2565,2566,2567,2568,2569")
    parser.add_argument("--raw-dir", default=str(RAW_DIR))
    parser.add_argument("--headed", action="store_true", help="show the browser window; useful when the source requires interaction")
    parser.add_argument("--pause-ms", type=int, default=250)
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
