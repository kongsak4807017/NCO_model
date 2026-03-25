const API_BASE = "http://127.0.0.1:8080/api";

document.addEventListener("DOMContentLoaded", () => {
    fetchOverview();
    fetchRanking();
    fetchScatter();
});

async function fetchOverview() {
    try {
        const res = await fetch(`${API_BASE}/overview`);
        const data = await res.json();
        if (data.metrics) {
            document.getElementById("kpi-total-districts").innerText = data.metrics.total_districts || 0;
            document.getElementById("kpi-critical").innerText = data.metrics.critical_districts || 0;
            document.getElementById("kpi-avg-hni").innerText = data.metrics.avg_hni ? data.metrics.avg_hni.toFixed(2) : "0.00";
            document.getElementById("kpi-avg-wci").innerText = data.metrics.avg_wci ? data.metrics.avg_wci.toFixed(2) : "0.00";
        }
    } catch (e) { console.error(e); }
}

let hospitalData = [];

async function fetchRanking() {
    try {
        const res = await fetch(`${API_BASE}/ranking`);
        const data = await res.json();
        if (data.ranking) {
            hospitalData = data.ranking;
            const tbody = document.getElementById("rankingBody");
            tbody.innerHTML = '';
            hospitalData.forEach((row, i) => {
                const tr = document.createElement("tr");
                tr.onclick = () => openDrilldown(row);
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${row.unit_name}</td>
                    <td>${row.Priority.toFixed(2)}</td>
                    <td>${row.HNI.toFixed(1)}</td>
                    <td>${row.WCI.toFixed(1)}</td>
                    <td>${row.doctor_hc}</td>
                    <td>${row.nurse_hc}</td>
                    <td>${row.pharmacist_hc}</td>
                `;
                tbody.appendChild(tr);
            });
            renderHeatmapBars(hospitalData);
        }
    } catch (e) { console.error(e); }
}

async function fetchScatter() {
    try {
        const res = await fetch(`${API_BASE}/scatter`);
        const data = await res.json();
        if (data.scatter) renderScatterChart(data.scatter);
    } catch (e) { console.error(e); }
}

function renderHeatmapBars(data) {
    const container = document.getElementById("map-container");
    container.innerHTML = "<div style='width:100%; height:100%; display:flex; flex-direction:column; gap:8px; padding:10px; overflow-y:auto;'></div>";
    const wrapper = container.querySelector("div");
    const maxP = Math.max(...data.map(d => d.Priority));
    data.forEach((d, idx) => {
        const pct = Math.min((d.Priority / (maxP || 1)) * 100, 100);
        const color = d.Priority > 20 ? "var(--danger)" : (d.Priority > 10 ? "#f59e0b" : "var(--accent)");
        wrapper.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; cursor:pointer;" onclick="openDrilldown(${idx})">
                <div style="width:140px; color:var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow:hidden;" title="${d.unit_name}">${d.unit_name}</div>
                <div style="flex:1; background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden;">
                    <div style="width:${pct}%; background:${color}; height:100%; border-radius:6px;"></div>
                </div>
                <div style="width:40px; text-align:right;">${Number(d.Priority).toFixed(1)}</div>
            </div>
        `;
    });
}

function renderScatterChart(scatterData) {
    const ctx = document.getElementById('scatterChart').getContext('2d');
    const points = scatterData.map(d => ({
        x: d.WCI_norm, y: d.HNI, hospital: d.unit_name, priority: d.Priority
    }));
    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Hospitals',
                data: points,
                backgroundColor: ctx => {
                    const val = ctx.raw?.priority;
                    if (val > 20) return '#ef4444'; 
                    if (val > 10) return '#f59e0b'; 
                    return '#3b82f6'; 
                },
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1, pointRadius: 6, pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Workforce Capacity (Norm)', color: '#94a3b8' }, grid: {color: 'rgba(255,255,255,0.05)'}, ticks: {color: '#94a3b8'} },
                y: { title: { display: true, text: 'Health Needs Index', color: '#94a3b8' }, grid: {color: 'rgba(255,255,255,0.05)'}, ticks: {color: '#94a3b8'} }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.raw.hospital} | HNI: ${ctx.raw.y.toFixed(1)} | WCI: ${ctx.raw.x.toFixed(1)}` } }
            }
        }
    });
}

async function openDrilldown(data) {
    const m = document.getElementById('drilldownModal');
    m.style.display = 'flex';
    document.getElementById("modalTitle").innerText = `รายละเอียดวิชาชีพ: ${data.unit_name}`;
    
    document.getElementById('profSummary').innerHTML = `
        <div class="summary-box"><div>แพทย์:</div> <strong>มีจริง ${data.doctor_hc} คน<br><span style="font-size:0.8rem;font-weight:normal;color:#94a3b8">(กรอบ ${data.doctor_fte.toFixed(1)} FTE)</span></strong></div>
        <div class="summary-box"><div>พยาบาล:</div> <strong>มีจริง ${data.nurse_hc} คน<br><span style="font-size:0.8rem;font-weight:normal;color:#94a3b8">(กรอบ ${data.nurse_fte.toFixed(1)} FTE)</span></strong></div>
        <div class="summary-box"><div>เภสัชกร:</div> <strong>มีจริง ${data.pharmacist_hc} คน<br><span style="font-size:0.8rem;font-weight:normal;color:#94a3b8">(กรอบ ${data.pharmacist_fte.toFixed(1)} FTE)</span></strong></div>
    `;
    
    // Render CMI Performance Data
    const cmiBody = document.getElementById('cmiBody');
    cmiBody.innerHTML = "";
    if (data.cmi_performance_json) {
        try {
            const parsedCmi = typeof data.cmi_performance_json === 'string' ? JSON.parse(data.cmi_performance_json) : data.cmi_performance_json;
            const keys = Object.keys(parsedCmi).sort();
            if (keys.length === 0) {
                cmiBody.innerHTML = "<tr><td colspan='2'>ไม่มีข้อมูล Performance (CMI)</td></tr>";
            } else {
                keys.forEach(k => {
                    const item = parsedCmi[k];
                    let rawPct = item.pct;
                    let pctVal = 0;
                    let pctStr = "-";
                    
                    if (rawPct !== null && rawPct !== undefined && rawPct !== "-") {
                        if (typeof rawPct === 'string') rawPct = rawPct.replace(/,/g, '');
                        const parsed = parseFloat(rawPct);
                        if (!isNaN(parsed)) {
                            pctVal = parsed;
                            pctStr = pctVal.toFixed(1) + '%';
                        }
                    }
                    
                    const pctColors = pctVal >= 80 ? 'var(--accent)' : (pctVal >= 50 ? '#f59e0b' : 'var(--danger)');
                    cmiBody.innerHTML += `
                        <tr>
                            <td style="font-size:0.85rem;" title="${item.name}">${k}: ${item.name}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <div style="flex:1; background:rgba(255,255,255,0.05); height:8px; border-radius:4px; overflow:hidden;">
                                        <div style="width:${Math.min(pctVal, 100)}%; background:${pctColors}; height:100%; border-radius:4px;"></div>
                                    </div>
                                    <span style="font-size:0.85rem; width:45px; text-align:right;">${pctStr}</span>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(e) {
            console.error(e);
            cmiBody.innerHTML = "<tr><td colspan='2'>เกิดข้อผิดพลาดในการโหลดข้อมูล CMI</td></tr>";
        }
    } else {
        cmiBody.innerHTML = "<tr><td colspan='2'>ไม่มีข้อมูล Performance (CMI)</td></tr>";
    }

    const tbody = document.getElementById('specialtyBody');
    tbody.innerHTML = "<tr><td colspan='2'>กำลังโหลดข้อมูลแพทย์เฉพาะทาง...</td></tr>";
    
    try {
        const res = await fetch(`${API_BASE}/specialties/${r.facility_id}`);
        const data = await res.json();
        tbody.innerHTML = "";
        if (data.specialties && data.specialties.length > 0) {
            data.specialties.sort((a,b)=>b.fte_val - a.fte_val).forEach(s => {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${s.position_specialist_name}</td><td><strong>${Number(s.fte_val).toFixed(2)}</strong></td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = "<tr><td colspan='2'>ไม่พบข้อมูลแพทย์เฉพาะทางสำหรับพื้นที่นี้</td></tr>";
        }
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='2'>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>";
    }
}

function closeDrilldown() { document.getElementById('drilldownModal').style.display = 'none'; }
// Close modal if click outside
window.onclick = function(event) {
    const modal = document.getElementById('drilldownModal');
    if (event.target == modal) { closeDrilldown(); }
}
