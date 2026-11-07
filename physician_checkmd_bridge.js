// Assisted CheckMD verification, browser-local. Never pretend an API lookup happened.
(function(root,factory){
 const api=factory(); if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.NCOCheckMD=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const norm=(s)=>String(s||"").normalize("NFKC").replace(/^(?:นพ\.?|พญ\.?|นายแพทย์|แพทย์หญิง)\s*/u,"").replace(/[\s\u200b\u200c\u200d._-]+/g,"").toLocaleLowerCase();
 const s=(value)=>String(value||"").trim();
 const officialLink=(url)=>/^https:\/\/checkmd\.tmc\.or\.th\/QrCode\?p=[0-9a-f]{32,}$/i.test(s(url));
 function parseOfficialResult({firstName,lastName,text,catalog}={}){
  const lines=String(text||"").split(/\r?\n/),issues=[];
  let match=null;
  for(const line of lines){match=line.match(/^\s*(?:นพ\.?|พญ\.?|นายแพทย์|แพทย์หญิง)\s+([^\s,]+)\s+([^\s,]+)/u);if(match)break;}
  const foundName=match?match[1]+" "+match[2]:"";
  const nameMatches=Boolean(match&&norm(firstName)===norm(match[1])&&norm(lastName)===norm(match[2]));
  const registered=/เป็นผู้ประกอบวิชาชีพเวชกรรมตั้งแต่\s*(?:พ\.?\s*ศ\.?\s*)?\d{4}/u.test(String(text||""))||/Permission to practice medicine since\s*\d{4}/i.test(String(text||""));
  const map=new Map();
  for(const item of catalog?.specialties||[])for(const label of [item.name_th,item.name_en])if(norm(label))map.set(norm(label),item);
  const specialties=[],seen=new Set();
  for(const line of lines){
   const m=line.match(/^\s*(?:[-*•]\s*)?(สาขา|อนุสาขา)\s+(.+?)\s*$/u);if(!m)continue;
   const raw=m[2].replace(/\s*\([^)]*\)\s*$/u,"").trim(),item=map.get(norm(raw)),key=item?.code||"raw:"+norm(raw);
   if(seen.has(key))continue;seen.add(key);
   specialties.push({level:m[1],raw_name:raw,code:item?.code||"",name_th:item?.name_th||raw,matched:Boolean(item)});
  }
  if(!s(firstName)||!s(lastName))issues.push("กรุณากรอกชื่อและนามสกุล");
  if(!match)issues.push("ไม่พบชื่อแพทย์ในผลที่คัดลอก");
  else if(!nameMatches)issues.push("ชื่อในผลตรวจไม่ตรงกับชื่อที่กรอก");
  if(!registered)issues.push("ไม่พบข้อความทะเบียนผู้ประกอบวิชาชีพเวชกรรม");
  if(!specialties.length)issues.push("ไม่พบสาขา/อนุสาขาในผลตรวจ");
  if(specialties.some(x=>!x.matched))issues.push("พบชื่อสาขาที่ต้องทำ crosswalk ก่อน");
  return {foundName,nameMatches,registered,specialties,usable:issues.length===0,issues};
 }
 function makeSupplyRow({parsed,specialtyCode,hospitalCode,year,physicianKey,fte,proofUrl="",reviewed=false}={}){
  if(!parsed?.usable)throw Error("ต้องมีผลตรวจที่ตรงชื่อและแยกสาขาได้ก่อน");
  const spec=parsed.specialties.find(x=>x.code===specialtyCode&&x.matched);
  if(!spec)throw Error("เลือกสาขาที่ตรวจพบจริง");
  if(!/^\d{5}$/.test(s(hospitalCode)))throw Error("รหัสโรงพยาบาลต้องเป็นตัวเลข 5 หลัก");
  if(!/^25\d{2}$/.test(s(year)))throw Error("กรุณาระบุปี พ.ศ. เช่น 2569");
  if(!/^[A-Za-z][A-Za-z0-9_-]{2,31}$/.test(s(physicianKey)))throw Error("ใช้รหัสแพทย์ภายในเริ่มด้วยอักษรอังกฤษ ไม่ใส่ชื่อจริงหรือเลขบัตร");
  if(!Number.isFinite(Number(fte))||Number(fte)<=0||Number(fte)>1)throw Error("FTE ต้อง > 0 และไม่เกิน 1");
  if(s(proofUrl)&&!officialLink(proofUrl))throw Error("หลักฐานต้องเป็นลิงก์ QR ของ checkmd.tmc.or.th เท่านั้น");
  return {hospital_code:s(hospitalCode),year:s(year),physician_key:s(physicianKey),
   specialty_name:spec.name_th,specialty_code:specialtyCode,fte:String(Number(fte)),
   source:officialLink(proofUrl)?s(proofUrl):"https://checkmd.tmc.or.th/v3 (manual search)",
   verification_status:reviewed?"Reviewed":"Draft"};
 }
 function enqueue(rows,row){
  const subset=rows.filter(r=>r.physician_key===row.physician_key&&r.year===row.year);
  if(subset.some(r=>r.hospital_code===row.hospital_code&&r.specialty_code===row.specialty_code))throw Error("รายการแพทย์/สาขา/โรงพยาบาลนี้ซ้ำ");
  if(subset.reduce((n,r)=>n+Number(r.fte),Number(row.fte))>1.000001)throw Error("แพทย์คนเดียวมี FTE รวมเกิน 1.0 ในปีเดียวกัน");
  return [...rows,row];
 }
 function setup(doc){
  const el=(id)=>doc.getElementById(id),state={catalog:null,parsed:null,rows:[]};
  const notice=(t)=>{el("tmcStatus").textContent=t;};
  const update=()=>{
   el("tmcCount").textContent="รอทวนสอบ "+state.rows.length+" รายการ (ไม่ส่งออกชื่อจริง)";
   el("tmcRows").replaceChildren();
   for(const row of state.rows){const li=doc.createElement("li");
    li.textContent=row.physician_key+" / "+row.hospital_code+" / "+row.year+" / "+row.specialty_name+" / "+row.fte+" FTE / "+row.verification_status;
    el("tmcRows").appendChild(li);}
   el("tmcExport").disabled=!state.rows.length;
  };
  async function copy(id){
   if(!s(el(id).value)){notice("กรอกชื่อก่อน");return;}
   try{await navigator.clipboard.writeText(el(id).value.trim());notice("คัดลอกแล้ว วางในเว็บแพทยสภาได้เลย");}
   catch{el(id).select();notice("เลือกข้อความไว้แล้ว กรุณากด Copy");}
  }
  el("tmcCopyFirst").addEventListener("click",()=>copy("tmcFirst"));
  el("tmcCopyLast").addEventListener("click",()=>copy("tmcLast"));
  el("tmcRead").addEventListener("click",()=>{
   if(!state.catalog){notice("ไม่พบบัญชีสาขาอ้างอิง");return;}
   state.parsed=parseOfficialResult({firstName:el("tmcFirst").value,lastName:el("tmcLast").value,
    text:el("tmcText").value,catalog:state.catalog});
   const select=el("tmcSelect");select.replaceChildren();
   for(const spec of state.parsed.specialties){const opt=doc.createElement("option");
    opt.value=spec.code;opt.textContent=spec.name_th+(spec.matched?"":" (ยังไม่รู้จัก)");opt.disabled=!spec.matched;select.append(opt);}
   notice(state.parsed.usable?"พบ "+state.parsed.specialties.length+" สาขา/อนุสาขา โปรดเลือกสาขาที่ทำงานจริง และให้ HR ตรวจสอบหลักฐาน":
    "ยังใช้ไม่ได้: "+state.parsed.issues.join(" / "));
  });
  el("tmcAdd").addEventListener("click",()=>{
   try{
    const row=makeSupplyRow({parsed:state.parsed,specialtyCode:el("tmcSelect").value,
     hospitalCode:el("tmcHospital").value,year:el("tmcYear").value,
     physicianKey:el("tmcKey").value,fte:el("tmcFte").value,
     proofUrl:el("tmcProof").value,reviewed:el("tmcReviewed").checked});
    state.rows=enqueue(state.rows,row);update();
    notice("เพิ่มรายการแล้ว ("+row.verification_status+") จากนี้นำเข้า workload จริงในส่วนขั้นสูงเพื่อคำนวณ FTE");
   }catch(err){notice("เพิ่มไม่ได้: "+err.message);}
  });
  el("tmcExport").addEventListener("click",()=>{
   const mapper=globalThis.NCOPhysicianSpecialtyMapping;
   if(!mapper)return;
   const csv=mapper.toCsv(state.rows,mapper.HEADERS.supply);
   const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
   const a=doc.createElement("a");a.href=url;a.download="physician_checkmd_supply_review.csv";
   doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  update();
  return {setCatalog(v){state.catalog=v;},getSupplyRows(){return state.rows.map(r=>({...r}));}};
 }
 return Object.freeze({parseOfficialResult,isOfficialProofUrl:officialLink,makeSupplyRow,enqueue,setup});
});
if(typeof document!=="undefined"&&document.getElementById("tmcStatus"))
 globalThis.NCOCheckMDBridge=globalThis.NCOCheckMD.setup(document);
