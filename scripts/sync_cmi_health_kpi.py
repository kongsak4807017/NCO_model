#!/usr/bin/env python3
"""Sync canonical Health KPI values from the public Chiang Mai CMI/Service Plan site.

The output is a static JSON snapshot for GitHub Pages. This avoids browser CORS
problems while keeping provenance back to the public source page.

Important:
- Service Plan codes are canonical for specialty outcomes.
- Legacy aliases A04/A09/B01 are NOT fetched as separate rows because they
  duplicate DH0102/CI0101/CM0101 in the HR Blueprint context.
- The parser discovers the fiscal-year select/form instead of hard-coding a
  vendor-specific parameter name.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse, parse_qsl, urlunparse
from urllib.request import Request, urlopen

BASE = "https://cmi.maewanghospital.go.th/web/index.php"
OUTPUT = Path("output/cmi_health_kpi_region1.json")
USER_AGENT = "NCO-HR-Blueprint/1.0 (+https://github.com/kongsak4807017/NCO_model)"

SERVICE_CODES = [
    "DH0101", "DH0102", "DN0101", "DN0142D", "CI0101", "PE0102",
    "CM0203", "CM0101", "DC0401", "DG0201", "PS0001", "RH0101",
]

LEGACY_ALIASES = {
    "A04": "DH0102",
    "A09": "CI0101",
    "B01": "CM0101",
}

PROVINCES = {
    "เชียงใหม่", "เชียงราย", "ลำพูน", "ลำปาง", "แพร่", "น่าน", "พะเยา", "แม่ฮ่องสอน"
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def number_or_none(value: str) -> float | None:
    text = clean_text(value).replace(",", "")
    if text in {"", "-", "—", "N/A"}:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(m.group(0)) if m else None


def fiscal_year_from_text(text: str) -> int | None:
    years = re.findall(r"(25\d{2})", text or "")
    return int(years[0]) if years else None


@dataclass
class SelectInfo:
    name: str = ""
    form_index: int | None = None
    options: list[dict[str, Any]] = field(default_factory=list)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

        self.headings: list[str] = []
        self._heading: list[str] | None = None
        self.text_chunks: list[str] = []

        self.forms: list[dict[str, Any]] = []
        self._form_stack: list[int] = []
        self.selects: list[SelectInfo] = []
        self._select_index: int | None = None
        self._option: dict[str, Any] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v or "") for k, v in attrs}
        tag = tag.lower()
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._heading = []
        elif tag == "form":
            idx = len(self.forms)
            self.forms.append({
                "method": (a.get("method") or "get").lower(),
                "action": a.get("action") or "",
                "inputs": {},
            })
            self._form_stack.append(idx)
        elif tag == "input" and self._form_stack:
            name = a.get("name") or ""
            if name:
                self.forms[self._form_stack[-1]]["inputs"][name] = a.get("value") or ""
        elif tag == "select":
            info = SelectInfo(
                name=a.get("name") or a.get("id") or "",
                form_index=self._form_stack[-1] if self._form_stack else None,
            )
            self.selects.append(info)
            self._select_index = len(self.selects) - 1
        elif tag == "option" and self._select_index is not None:
            self._option = {
                "value": a.get("value") or "",
                "selected": "selected" in a,
                "text_parts": [],
            }

    def handle_data(self, data: str) -> None:
        if not data:
            return
        text = clean_text(data)
        if not text:
            return
        self.text_chunks.append(text)
        if self._cell is not None:
            self._cell.append(text)
        if self._heading is not None:
            self._heading.append(text)
        if self._option is not None:
            self._option["text_parts"].append(text)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(clean_text(" ".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(clean_text(c) for c in self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append(self._table)
            self._table = None
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"} and self._heading is not None:
            h = clean_text(" ".join(self._heading))
            if h:
                self.headings.append(h)
            self._heading = None
        elif tag == "option" and self._option is not None and self._select_index is not None:
            self._option["text"] = clean_text(" ".join(self._option.pop("text_parts")))
            self.selects[self._select_index].options.append(self._option)
            self._option = None
        elif tag == "select":
            self._select_index = None
        elif tag == "form" and self._form_stack:
            self._form_stack.pop()


def request_html(url: str, method: str = "GET", data: dict[str, str] | None = None, timeout: int = 45) -> str:
    payload = None
    if method.upper() == "POST" and data is not None:
        payload = urlencode(data).encode("utf-8")
    elif data:
        parsed = urlparse(url)
        q = dict(parse_qsl(parsed.query, keep_blank_values=True))
        q.update(data)
        url = urlunparse(parsed._replace(query=urlencode(q)))
    req = Request(url, data=payload, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urlopen(req, timeout=timeout) as res:
        raw = res.read()
        charset = res.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def parse_page(html: str) -> PageParser:
    p = PageParser()
    p.feed(html)
    return p


def source_url(code: str) -> str:
    return f"{BASE}?{urlencode({'co_thip_new': code, 'r': 'service/index'})}"


def find_year_select(parser: PageParser) -> SelectInfo | None:
    best = None
    best_count = 0
    for sel in parser.selects:
        count = sum(1 for o in sel.options if fiscal_year_from_text(o.get("text", "")) or fiscal_year_from_text(o.get("value", "")))
        if count > best_count:
            best, best_count = sel, count
    return best if best_count else None


def year_options(sel: SelectInfo | None) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    if not sel:
        return out
    seen: set[int] = set()
    for o in sel.options:
        year = fiscal_year_from_text(o.get("text", "")) or fiscal_year_from_text(o.get("value", ""))
        if year and year not in seen:
            seen.add(year)
            out.append((year, o.get("value") or str(year)))
    return out


def fetch_for_year(code: str, initial_html: str, initial_parser: PageParser, year: int, option_value: str) -> str:
    sel = find_year_select(initial_parser)
    if not sel or not sel.name:
        return initial_html

    form = initial_parser.forms[sel.form_index] if sel.form_index is not None and sel.form_index < len(initial_parser.forms) else None
    method = (form or {}).get("method", "get").upper()
    action = urljoin(source_url(code), (form or {}).get("action") or source_url(code))
    data = dict((form or {}).get("inputs") or {})
    data[sel.name] = option_value

    # Preserve route + indicator selection even if the form omitted them as hidden inputs.
    parsed = urlparse(source_url(code))
    for k, v in parse_qsl(parsed.query):
        data.setdefault(k, v)

    return request_html(action, method=method, data=data)


def indicator_title(parser: PageParser, code: str) -> str:
    for h in parser.headings:
        if re.search(rf"\b{re.escape(code)}\b", h, re.I):
            return clean_text(re.sub(rf"^.*?\b{re.escape(code)}\b\s*", "", h, flags=re.I)) or code
    text = " | ".join(parser.text_chunks[:300])
    m = re.search(rf"\b{re.escape(code)}\b\s+([^|]+)", text, re.I)
    return clean_text(m.group(1)) if m else code


def page_year(parser: PageParser) -> int | None:
    # Prefer selected year option, then visible fiscal-year text.
    sel = find_year_select(parser)
    if sel:
        for o in sel.options:
            if o.get("selected"):
                y = fiscal_year_from_text(o.get("text", "")) or fiscal_year_from_text(o.get("value", ""))
                if y:
                    return y
    return fiscal_year_from_text(" ".join(parser.text_chunks))


def unit_from_header(header: str) -> str:
    h = clean_text(header)
    if "ร้อยละ" in h or "%" in h:
        return "%"
    if "ต่อพัน" in h:
        return "/1000"
    if "ต่อแสน" in h or "100,000" in h or "100000" in h:
        return "/100k"
    return ""


def extract_records(parser: PageParser, code: str, year: int, url: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    title = indicator_title(parser, code)

    for table in parser.tables:
        header_idx = None
        hospital_col = None
        for i, row in enumerate(table):
            joined = " | ".join(row)
            if "สถานพยาบาล" in joined and ("จังหวัด" in joined or "ชื่อจังหวัด" in joined):
                header_idx = i
                for j, cell in enumerate(row):
                    if "สถานพยาบาล" in cell:
                        hospital_col = j
                        break
                break
        if header_idx is None:
            continue

        header = table[header_idx]
        metric_header = header[-1] if header else ""
        unit = unit_from_header(metric_header)

        for row in table[header_idx + 1:]:
            if not row:
                continue
            hosp_idx = None
            for j, cell in enumerate(row):
                if re.match(r"^\d{5}\s+", clean_text(cell)):
                    hosp_idx = j
                    break
            if hosp_idx is None or hosp_idx < 1:
                continue

            province = clean_text(row[hosp_idx - 2]) if hosp_idx >= 2 else clean_text(row[0])
            level = clean_text(row[hosp_idx - 1]) if hosp_idx >= 1 else ""
            if province not in PROVINCES:
                # Sometimes a leading details cell shifts columns.
                province = next((clean_text(c) for c in row[:hosp_idx] if clean_text(c) in PROVINCES), province)
            if province not in PROVINCES:
                continue

            hospital_text = clean_text(row[hosp_idx])
            hm = re.match(r"^(\d{5})\s*(.*)$", hospital_text)
            if not hm:
                continue
            hospital_code, hospital_name = hm.group(1), clean_text(hm.group(2))

            nums = [number_or_none(c) for c in row[hosp_idx + 1:]]
            nums = [x for x in nums if x is not None]
            if not nums:
                continue

            numerator = nums[0] if len(nums) >= 3 else None
            denominator = nums[1] if len(nums) >= 3 else None
            value = nums[-1]
            records.append({
                "year": year,
                "indicator_code": code,
                "indicator_name": title,
                "province": province,
                "level": level,
                "hospital_code": hospital_code,
                "hospital_name": hospital_name,
                "numerator": numerator,
                "denominator": denominator,
                "value": value,
                "unit": unit,
                "source_url": url,
            })
        if records:
            break

    return records


def sync(codes: list[str], min_year: int | None = None, max_year: int | None = None, sleep_seconds: float = 0.25) -> dict[str, Any]:
    all_records: list[dict[str, Any]] = []
    catalog: dict[str, Any] = {}
    errors: list[dict[str, str]] = []

    for code in codes:
        url = source_url(code)
        try:
            initial_html = request_html(url)
            initial_parser = parse_page(initial_html)
            options = year_options(find_year_select(initial_parser))
            current_year = page_year(initial_parser)
            if not options and current_year:
                options = [(current_year, str(current_year))]
            if min_year is not None:
                options = [x for x in options if x[0] >= min_year]
            if max_year is not None:
                options = [x for x in options if x[0] <= max_year]
            if not options and current_year:
                options = [(current_year, str(current_year))]

            title = indicator_title(initial_parser, code)
            catalog[code] = {
                "code": code,
                "name": title,
                "source_url": url,
                "available_years": [y for y, _ in options],
            }

            seen_years: set[int] = set()
            for year, option_value in options:
                try:
                    html = initial_html if year == current_year else fetch_for_year(code, initial_html, initial_parser, year, option_value)
                    parser = parse_page(html)
                    actual_year = page_year(parser) or year
                    if actual_year in seen_years:
                        continue
                    seen_years.add(actual_year)
                    records = extract_records(parser, code, actual_year, url)
                    all_records.extend(records)
                except Exception as exc:
                    errors.append({"indicator_code": code, "year": str(year), "error": str(exc)})
                time.sleep(sleep_seconds)
        except Exception as exc:
            errors.append({"indicator_code": code, "year": "", "error": str(exc)})

    return {
        "schema_version": "nco-cmi-kpi-snapshot-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_system": "CMI / Service Plan Region 1",
        "source_base_url": BASE,
        "canonical_policy": {
            "legacy_aliases": LEGACY_ALIASES,
            "note": "A04/A09/B01 are aliases and are not stored as separate rows from DH0102/CI0101/CM0101.",
        },
        "catalog": catalog,
        "records": all_records,
        "errors": errors,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default=str(OUTPUT))
    ap.add_argument("--codes", default=",".join(SERVICE_CODES))
    ap.add_argument("--min-year", type=int, default=2566)
    ap.add_argument("--max-year", type=int, default=2570)
    ap.add_argument("--allow-empty", action="store_true")
    args = ap.parse_args()

    codes = [x.strip() for x in args.codes.split(",") if x.strip()]
    data = sync(codes, args.min_year, args.max_year)
    if not data["records"] and not args.allow_empty:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        print("ERROR: no CMI KPI records parsed", file=sys.stderr)
        return 2

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(data['records'])} records for {len(data['catalog'])} indicators to {out}")
    if data["errors"]:
        print(f"Warnings/errors: {len(data['errors'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
