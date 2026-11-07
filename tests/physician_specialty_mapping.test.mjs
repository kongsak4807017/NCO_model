import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const engine = require(resolve(root, "physician_specialty_mapping.js"));
const catalog = JSON.parse(readFileSync(resolve(root, "data/physician_specialties_tmc.json"), "utf8"));
const med = catalog.specialties.find((s) => s.name_th === "อายุรศาสตร์");
const surg = catalog.specialties.find((s) => s.name_th === "ศัลยศาสตร์");
const physician = (code=med.code, extra={}) => ({
  hospital_code:"12345",year:"2569",physician_key:"anonymous-01",specialty_code:code,fte:"1",
  source:"approved HROPS extract",verification_status:"Verified",...extra,
});
const service = (code=med.code, extra={}) => ({
  hospital_code:"12345",year:"2569",specialty_code:code,activity_code:"verified_opd",volume:"100",
  volume_unit:"visits",minutes_per_unit:"30",standard_unit:"minutes/visit",awt_minutes:"1000",
  cas_percent:"0",ias_hours:"0",source:"HIS verified aggregate",workload_verification_status:"Verified",
  standard_source:"signed time-motion standard",standard_verification_status:"Verified",overlap_policy:"deduplicated",...extra,
});
const run = ({ supply=[physician()], workload=[service()], crosswalk=[] }={}) =>
  engine.compute({catalog,supply,workload,crosswalk});

test("official training-path catalog has 14 + 27 + 61 names with unique internal IDs", () => {
  assert.equal(catalog.specialties.length,102);
  assert.equal(new Set(catalog.specialties.map((s)=>s.code)).size,102);
  assert.deepEqual([1,2,3].map((n)=>catalog.specialties.filter((s)=>s.training_category===n).length),[14,27,61]);
  assert.ok(med && surg);
  assert.match(catalog.notes.join(" " ),/not official Medical Council codes/i);
});

test("CSV parser handles BOM, comma, quote, embedded newline and missing column count",()=>{
  const rows=engine.parseCsv('\uFEFFa,b\r\n"x,y","q""z"\r\n"hello\nworld",2\r\n');
  assert.deepEqual(rows,[{a:"x,y",b:'q"z'},{a:"hello\nworld",b:"2"}]);
  assert.throws(()=>engine.parseCsv("a,b\n1\n"),/fields/);
  assert.throws(()=>engine.parseCsv('a,b\n"not closed,2'),/Unterminated/);
});

test("verified observed input computes WISN base and does not confuse specialty headcount with demand",()=>{
  const result=run();
  assert.deepEqual(result.issues,[]);
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].data_fitness,"VERIFIED");
  assert.equal(result.results[0].headcount,1);
  assert.equal(result.results[0].actual_fte,1);
  assert.equal(result.results[0].required_fte,3);
  assert.equal(result.results[0].gap_fte,2);
});

test("CAS, IAS applied once per specialty group after summing distinct activities",()=>{
  const x=run({ workload:[
    service(med.code,{volume:"50",minutes_per_unit:"20",cas_percent:"20",ias_hours:"2"}),
    service(med.code,{activity_code:"procedure",volume:"10",minutes_per_unit:"40",cas_percent:"20",ias_hours:"2",volume_unit:"procedures",standard_unit:"minutes/procedure"}),
  ]}).results[0];
  assert.equal(x.data_fitness,"VERIFIED");
  assert.equal(x.required_fte,1.87); // (1000 + 400) / 1000 / 0.8 + 120 / 1000 = 1.87
});

test("missing supply or workload is BLOCKED, never assumes zero",()=>{
  for(const input of [{supply:[]},{workload:[]}]){
    const x=run(input).results[0];
    assert.equal(x.data_fitness,"BLOCKED");
    assert.equal(x.actual_fte,null);
    assert.equal(x.required_fte,null);
    assert.equal(x.gap_fte,null);
  }
});

test("nonverified but complete source is PROVISIONAL, not approved staffing",()=>{
  const x=run({supply:[physician(med.code,{verification_status:"Reviewed"})]}).results[0];
  assert.equal(x.data_fitness,"PROVISIONAL");
  assert.equal(x.gap_fte,2);
});

test("contradictory explicit code/name, Gregorian year and zero assigned FTE are rejected",()=>{
  const contradictory = run({supply:[physician(med.code,{specialty_name:surg.name_th})]}).results[0];
  assert.equal(contradictory.data_fitness,"BLOCKED");
  assert.equal(run({supply:[physician(med.code,{fte:"0"})]}).results[0].data_fitness,"BLOCKED");
  assert.ok(run({supply:[physician(med.code,{year:"2026"})]}).issues.some((x)=>x.kind==="supply"));
});

test("one physician's sum across facilities and specialties cannot exceed 1 FTE",()=>{
  const r=run({supply:[physician(med.code,{fte:"0.7"}),physician(surg.code,{fte:"0.6"})],
    workload:[service(med.code),service(surg.code)]});
  assert.ok(r.results.every((row)=>row.data_fitness==="BLOCKED"));
  assert.ok(r.issues.some((item)=>/exceeds 1.0/.test(item.detail)));
});

test("unsafe unit, provenance, unknown overlap and duplicated activities block",()=>{
  for(const extra of [
    {volume_unit:"visits",standard_unit:"minutes/admission"},
    {standard_source:""},
    {source:""},
    {overlap_policy:"unknown"},
  ]) {
    assert.equal(run({workload:[service(med.code,extra)]}).results[0].data_fitness,"BLOCKED");
  }
  assert.equal(run({workload:[service(),service()]}).results[0].data_fitness,"BLOCKED");
});

test("no fuzzy specialty guess; only exact catalog name or approved crosswalk",()=>{
  const unknown=physician("",{specialty_code:"",specialty_name:"อายุรกรรมXYZ"});
  const ref=service(med.code);
  const a=run({supply:[unknown],workload:[ref]});
  assert.equal(a.results[0].data_fitness,"BLOCKED");
  assert.ok(a.issues.some((i)=>/Unmapped/.test(i.detail)));
  const b=run({supply:[unknown],workload:[ref],crosswalk:[
    {raw_specialty_name:"อายุรกรรมXYZ",specialty_code:med.code,verification_status:"Verified",approved_by:"Regional HR",source:"signed crosswalk"}
  ]});
  assert.equal(b.results[0].data_fitness,"VERIFIED");
});

test("unapproved crosswalk is rejected and no automatic mapping occurs",()=>{
  const r=run({supply:[physician("",{specialty_code:"",specialty_name:"not-an-official-name"})],
    crosswalk:[{raw_specialty_name:"not-an-official-name",specialty_code:med.code,verification_status:"Draft",source:"",approved_by:""}]});
  assert.ok(r.issues.some((i)=>i.kind==="crosswalk"));
  assert.equal(r.results[0].data_fitness,"BLOCKED");
});

test("CSV download escapes spreadsheet formula injection in names",()=>{
  assert.equal(engine.toCsv([{name:"=HYPERLINK(1)"}],["name"]),"name\r\n'=HYPERLINK(1)\r\n");
  assert.equal(engine.toCsv([{number:-3}],["number"]),"number\r\n-3\r\n");
});

test("the standalone UI loads catalog from repo and never posts person-level data",()=>{
  const html=readFileSync(resolve(root,"physician_specialty_mapping.html"),"utf8");
  assert.match(html,/data\/physician_specialties_tmc\.json/);
  assert.match(html,/pseudonymization/);
  assert.doesNotMatch(html,/\bPOST\b|XMLHttpRequest/);
});
