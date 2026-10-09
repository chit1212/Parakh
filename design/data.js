(function () {
  const FX = 88.20, FXDATE = '8 Oct 2026';
  const PRINT = { none: 0, '1-col': 0.35, '2-col': 0.60, '4-col': 1.40 };
  const PRINT_LY = { none: 0, '1-col': 0.40, '2-col': 0.55, '4-col': 1.30 };
  const TU = { B: 1.32, C: 1.45, E: 1.25 };
  const RAW = [
    ['MG-500 outer carton', 3, 'B', 320, 240, 260, [150, 120, 150], 18, '1-col', 60],
    ['MG-750 outer carton', 3, 'B', 340, 250, 280, [180, 120, 180], 20, '2-col', 48],
    ['Steam iron SI-22 carton', 3, 'B', 300, 140, 170, [150, 120, 150], 18, '2-col', 90],
    ['Dry iron DI-10 carton', 3, 'B', 260, 120, 140, [150, 120, 150], 16, '1-col', 75],
    ['Ceiling fan motor CF-1200', 5, 'BC', 330, 330, 210, [180, 120, 150, 120, 180], 22, '1-col', 40],
    ['Fan blade set CF-1200', 3, 'B', 640, 140, 90, [150, 120, 150], 18, 'none', 40],
    ['Table fan TF-400', 5, 'BC', 450, 200, 460, [150, 120, 150, 120, 150], 20, '2-col', 22],
    ['Pedestal fan PF-400 base', 5, 'BC', 520, 220, 480, [180, 120, 150, 120, 180], 22, '2-col', 18],
    ['Room heater RH-2000', 5, 'BC', 420, 200, 520, [180, 120, 150, 120, 180], 22, '4-col', 12],
    ['Water heater 15 L', 5, 'BC', 420, 400, 480, [200, 140, 150, 140, 200], 24, '2-col', 15],
    ['Water heater 25 L', 5, 'BC', 480, 450, 560, [200, 140, 150, 140, 200], 24, '2-col', 14],
    ['Induction cooktop IC-2100', 3, 'B', 380, 320, 110, [180, 120, 180], 20, '4-col', 35],
    ['Air cooler AC-40 outer', 5, 'BC', 520, 420, 960, [230, 140, 180, 140, 230], 26, '2-col', 8],
    ['Exhaust fan EF-250', 5, 'BC', 320, 320, 180, [180, 120, 150, 120, 180], 22, '1-col', 60],
    ['Kettle EK-1.5 carton', 3, 'B', 230, 200, 250, [150, 120, 150], 18, '4-col', 55],
    ['Sandwich maker SM-2', 3, 'B', 300, 270, 110, [150, 120, 150], 18, '4-col', 30],
    ['OTG 28 L carton', 5, 'BC', 560, 420, 380, [180, 120, 150, 120, 180], 22, '2-col', 10],
    ['Hand blender HB-300', 3, 'E', 340, 110, 110, [150, 100, 150], 16, '4-col', 45],
    ['Juicer JMG-3 carton', 5, 'BC', 380, 300, 320, [180, 120, 150, 120, 180], 22, '2-col', 25],
    ['Chimney CH-60 carton', 5, 'BC', 640, 520, 420, [230, 140, 180, 140, 230], 26, '1-col', 6],
    ['Mixer jar spare set', 3, 'B', 260, 260, 220, [150, 120, 150], 16, 'none', 20],
    ['Steam iron master (6 nos)', 5, 'BC', 620, 440, 360, [180, 120, 150, 120, 180], 22, '1-col', 15],
    ['Kettle master (8 nos)', 5, 'BC', 480, 420, 520, [180, 120, 150, 120, 180], 22, '1-col', 7],
    ['MG-500 master (2 nos)', 5, 'BC', 500, 340, 290, [180, 120, 150, 120, 180], 22, '1-col', 30],
    ['Spare parts carton S', 3, 'B', 200, 150, 100, [120, 100, 120], 14, 'none', 80],
    ['Spare parts carton M', 3, 'B', 300, 200, 150, [120, 100, 120], 14, 'none', 50],
    ['MG-1000 outer carton', 3, 'C', 360, 260, 300, [180, 120, 180], 20, '2-col', 20],
    ['Air cooler AC-70 outer', 5, 'BC', 600, 480, 1100, [230, 140, 180, 140, 230], 28, '2-col', 5],
    ['Tower fan TW-36 carton', 5, 'BC', 280, 280, 1000, [180, 120, 150, 120, 180], 22, '2-col', 9],
    ['Warranty card sleeve', 3, 'E', 240, 170, 30, [150, 100, 150], 16, '1-col', 100]
  ];
  const r2 = x => Math.round(x * 100) / 100;
  const rnd = s => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const inr = (x, d = 2) => x == null ? '—' : '₹' + x.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (x, d = 2) => x == null ? '—' : x.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const lakh = x => '₹' + (x / 1e5).toFixed(2) + ' L';
  const crore = x => '₹' + (x / 1e7).toFixed(2) + ' Cr';

  const lines = RAW.map((a, i) => {
    const [name, ply, flute, L, W, H, g, bf, print, qtyK] = a;
    const bl = 2 * (L + W) + 35, bw = W + H, area = bl * bw / 1e6;
    const gsm = ply === 3 ? g[0] + g[1] * TU[flute] + g[2] : g[0] + g[1] * TU.B + g[2] + g[3] * TU.C + g[4];
    const kg = area * gsm / 1000;
    const sc = r2(kg * (ply === 3 ? 41 : 44) + PRINT[print]);
    return {
      i, n: i + 1, id: 'L' + String(i + 1).padStart(2, '0'), name, ply, flute, dims: `${L}×${W}×${H}`,
      gsm: g.join('/'), bf, print, printLabel: print === 'none' ? 'plain' : print + ' print',
      qtyK, qty: qtyK * 1000, blank: `${bl}×${bw} mm`, gsmTot: Math.round(gsm), kg, sc, lastYear: i < 25,
      lyPrice: i < 25 ? r2(sc * (0.93 + rnd(i + 99) * 0.04)) : null,
      spec: `${ply}-ply ${flute} · ${L}×${W}×${H} mm · ${g.join('/')} GSM · BF ${bf} · ${print === 'none' ? 'plain' : print}`
    };
  });

  const vendors = [
    { id: 'SB', name: 'Shree Balaji Corrugators', short: 'Shree Balaji', city: 'Bhiwandi', fmt: 'Excel', icon: 'ph-microsoft-excel-logo', file: 'SBC_Rates_FY27_rev2.xlsx', shape: 'Excel in their own layout, ignored our template', contact: 'Mahesh Agarwal', received: '6 Oct, 11:20', revised: 'Revised quote 8 Oct, 18:40', colNote: 'Revised quote v2', basis: 'Per box, delivered Chakan', coverage: 30,
      q: { score: 95, cleared: true, returned: true, mandFail: 0, label: '95 · cleared' },
      docs: [['ISO 9001:2015 certificate', 'Valid to Mar 2028'], ['Burst & BCT test report', 'Sep 2026, NABL lab'], ['Mill certificates (kraft)', '3 mills named']] },
    { id: 'VP', name: 'Vardhman Packwell Exports', short: 'Vardhman', city: 'Daman', fmt: 'PDF', icon: 'ph-file-pdf', file: 'VPE-Q-2026-118.pdf', shape: 'PDF on letterhead, priced in USD, discount in a footnote', contact: 'Ritu Shah', received: '6 Oct, 16:05', colNote: 'USD @ ₹88.20, −2.5% ‡', basis: 'USD per box, delivered', coverage: 30,
      q: { score: 95, cleared: true, returned: true, mandFail: 0, label: '95 · cleared' },
      docs: [['ISO 9001:2015 certificate', 'Valid to Nov 2027'], ['Burst & BCT test report', 'Aug 2026, in-house'], ['FSC chain of custody', 'Valid']] },
    { id: 'KP', name: 'Kaveri Paper Products', short: 'Kaveri', city: 'Hosur', fmt: 'Word', icon: 'ph-file-doc', file: 'Kaveri_offer_Sahyadri.docx', shape: 'Word letter, commercials written in paragraphs, per 100 pieces', contact: 'S. Raghunathan', received: '7 Oct, 10:42', colNote: 'Per 100 → per box', basis: '₹ per 100 nos + freight', coverage: 30,
      q: { score: 75, cleared: true, returned: true, mandFail: 0, label: '75 · cleared' },
      docs: [['ISO 9001:2015 certificate', 'Valid to Jun 2027'], ['Burst test report', 'Jul 2026, in-house']] },
    { id: 'AC', name: 'Anand Cartons', short: 'Anand', city: 'Ahmedabad', fmt: 'Photo', icon: 'ph-camera', file: 'IMG_20261007_093114.jpg', shape: 'Phone photo of a printed rate card, taken at an angle', contact: 'Dilip Anand', received: '7 Oct, 09:31', colNote: '27 of 30 quoted', basis: '₹ per box, delivered Pune region', coverage: 27,
      q: { score: 20, cleared: false, returned: true, mandFail: 2, label: '20 · not cleared' },
      docs: [['Burst test report', 'Jan 2025, expired'], ['ISO 9001', 'Not attached']] },
    { id: 'RB', name: 'Rohit Box Industries', short: 'Rohit Box', city: 'Pune', fmt: 'Email', icon: 'ph-envelope-simple', file: 'Email from Rohit Jadhav, 7 Oct, 20:12', shape: 'One-line email: per kg, "rest same as last year", freight extra', contact: 'Rohit Jadhav', received: '7 Oct, 20:12', colNote: 'Per kg, freight est.', basis: '₹ per kg, freight extra', coverage: 30,
      q: { score: null, cleared: false, returned: false, mandFail: null, label: 'not returned' },
      docs: [] }
  ];
  const VI = {}; vendors.forEach((v, k) => { v.k = k; VI[v.id] = v; });

  const questions = [
    ['ISO 9001:2015 certificate', true], ['Burst / BCT test report under 12 months', true], ['In-house lab: burst, ECT, moisture', false],
    ['Kraft paper source: named mills', false], ['Moisture at dispatch ≤ 9%', false], ['Capacity ≥ 400 t per month', false],
    ['Lead time ≤ 7 days from PO', false], ['Rejection rate, last 12 months', false], ['Credit period 60 days', false], ['Named account manager', false]
  ];
  const answers = {
    SB: ['Yes', 'Yes', 'Yes', 'BILT, JK Paper, Emami', '8%', '650 t', '5 days', '0.6%', '60 days', 'Yes'],
    VP: ['Yes', 'Yes', 'Yes', 'JK Paper, ITC', '7.5%', '900 t', '7 days', '0.4%', '45 days', 'Yes'],
    KP: ['Yes', 'Yes', 'Burst only', 'Seshasayee', '9%', '420 t', '7 days', '1.1%', '60 days', 'No'],
    AC: ['No', 'Jan 2025', 'No', 'Local mills', '10%', '300 t', '4 days', 'Not stated', '30 days', 'Yes'],
    RB: Array(10).fill('—')
  };
  const qPass = {
    SB: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], VP: [1, 1, 1, 1, 1, 1, 1, 1, 0, 1], KP: [1, 1, 0, 1, 1, 1, 1, 0, 1, 0],
    AC: [0, 0, 0, 0, 0, 0, 1, 0, 0, 1], RB: Array(10).fill(null)
  };

  const BASE = { SB: 1.03, VP: 1.02, KP: 1.01, AC: 0.975 };
  const F_OVR = { 'AC5': 0.84, 'SB24': 1.16, 'KP12': 1.14 };
  const fac = (v, i) => F_OVR[v + i] ?? (BASE[v] + (rnd(i * 7 + v.charCodeAt(0) * 3 + v.charCodeAt(1)) - 0.5) * 0.09);
  const REV = [2, 6, 11, 15];
  const AC_MISS = [7, 20, 29];
  const sbOrder = lines.map(l => l.i).sort((a, b) => (a * 7) % 30 - (b * 7) % 30);
  const sbRow = {}; sbOrder.forEach((i, k) => sbRow[i] = 6 + k);
  const short = l => l.name.toUpperCase().replace(/-/g, '').replace(' CARTON', ' CTN').replace(' OUTER', ' OUTER');

  const cells = {}; vendors.forEach(v => cells[v.id] = []);
  lines.forEach(l => {
    const i = l.i, ratioOk = true;
    // SB
    let p = r2(l.sc * fac('SB', i));
    const sb = { vid: 'SB', i, p, raw: inr(p), unit: 'per pc, delivered', kind: 'ok', loc: `Sheet "Rates 26-27", cell F${sbRow[i]}`, conf: 0.99,
      steps: [['Read', 'AI', `Cell F${sbRow[i]} reads ${inr(p)}; row matched to ${l.id} by spec (${l.dims}, ${l.ply}-ply, BF ${l.bf}) — their item "${short(l)}"`], ['Calculate', 'Code', 'Already per box, delivered, ex-GST. No conversion.'], ['Verify', 'Check', 'Second read matches. Unit and spec match.']] };
    if (REV.includes(i)) { sb.rev = r2(p / 0.97); sb.steps[0][2] += `. Supersedes v1 ${inr(sb.rev)} (6 Oct).`; }
    cells.SB[i] = sb;
    // KP
    p = r2(l.sc * fac('KP', i)); const per100 = Math.round(p * 100); p = per100 / 100;
    cells.KP[i] = { vid: 'KP', i, p, raw: `₹${(per100 - 38).toLocaleString('en-IN')} per 100 nos`, unit: '+ ₹38 freight per 100', kind: 'conv', loc: `Page 2, para ${3 + Math.floor(i / 6)}, sentence ${1 + i % 6}`, conf: 0.97,
      steps: [['Read', 'AI', `Sentence reads "₹${(per100 - 38).toLocaleString('en-IN')} per 100 nos" for the ${l.dims} box; freight "₹38 per 100 nos" from para 7`], ['Calculate', 'Code', `(₹${(per100 - 38).toLocaleString('en-IN')} + ₹38) ÷ 100 = ${inr(p)} per box`], ['Verify', 'Check', 'Second read matches. "Per hundred" confirmed in two places.']] };
    // AC
    if (AC_MISS.includes(i)) cells.AC[i] = { vid: 'AC', i, p: null, raw: 'Not on rate card', unit: '', kind: 'miss', loc: 'No matching row on the photographed card', steps: [['Read', 'AI', `No row on the card matches ${l.dims} ${l.ply}-ply. Checked both sides of the photo.`], ['Calculate', 'Code', 'Not priced. Excluded from this line.'], ['Verify', 'Check', 'Second read agrees: not quoted.']] };
    else {
      p = r2(l.sc * fac('AC', i)); const conf = r2(0.88 + rnd(i + 31) * 0.1);
      cells.AC[i] = { vid: 'AC', i, p, raw: inr(p), unit: 'per box, delivered', kind: 'ok', loc: `Photo, row ${i + 3} of rate card`, conf,
        steps: [['Read', 'AI', `Rate card row "${l.dims.replace(/×/g, '*')} ${l.ply} PLY" reads ${inr(p)} (read confidence ${conf})`], ['Calculate', 'Code', 'Per box, delivered Pune region. No conversion.'], ['Verify', 'Check', 'Second read matches.']] };
    }
    // RB
    const rate = l.ply === 3 ? 38 : 42, board = r2(l.kg * rate);
    const pr = l.lastYear ? PRINT_LY[l.print] : PRINT_LY[l.print];
    p = r2(board + pr + 0.42);
    const ly = l.print !== 'none';
    cells.RB[i] = { vid: 'RB', i, p, raw: `₹${rate}/kg`, unit: `${l.ply}-ply, freight extra`, kind: ly && l.lastYear ? 'ly' : 'conv', loc: 'Email body, line 1', conf: 0.99, ly: ly && l.lastYear,
      steps: [['Read', 'AI', `"₹${rate}/kg for the ${l.ply}-ply"${ly ? ', "rest same as last year"' : ''}, "freight extra"`],
        ['Calculate', 'Code', `Board weight ${l.kg.toFixed(3)} kg (blank ${l.blank} × ${l.gsmTot} g/m²) × ₹${rate} = ${inr(board)}` + (ly ? ` + print ${inr(pr)} ${l.lastYear ? '(SE-2025-037, ' + l.print + ')' : '(no last-year price; nearest spec)'}` : '') + ` + freight est. ₹0.42 (FY26 lane avg, Pune → Chakan) = ${inr(p)}`],
        ['Verify', 'Check', 'Weight formula re-run independently. Last-year terms looked up in SE-2025-037.']] };
    // VP
    const tgt = r2(l.sc * fac('VP', i)); const usd = Math.round(tgt / 0.975 / FX * 1000) / 1000;
    cells.VP[i] = mkVP(l, usd);
  });
  function mkVP(l, usd) {
    const gross = r2(usd * FX), p = r2(usd * FX * 0.975);
    return { vid: 'VP', i: l.i, p, gross, raw: `USD ${usd.toFixed(3)}`, unit: 'per box, delivered', kind: 'conv', loc: `Page ${l.i < 16 ? 2 : 3}, table row ${l.n}; footnote ‡ p. 3`, conf: 0.98, usd,
      steps: [['Read', 'AI', `Row ${l.n} reads "USD ${usd.toFixed(3)}"; footnote ‡ reads "2.5% discount on orders above ₹25 lakh per PO"`], ['Calculate', 'Code', `USD ${usd.toFixed(3)} × ₹${FX} (RBI ref., ${FXDATE}) = ${inr(gross)}, less 2.5% ‡ = ${inr(p)}`], ['Verify', 'Check', 'Second read matches. FX rate pulled from RBI reference, not read from the PDF.']] };
  }
  const othersMin = (i, ex) => Math.min(...vendors.filter(v => v.id !== ex).map(v => cells[v.id][i].p).filter(x => x != null));
  // forced stories
  [4, 10, 23].forEach(i => { const t = othersMin(i, 'VP') - 0.10; const usd = Math.floor(t / 0.975 / FX * 1000) / 1000; cells.VP[i] = mkVP(lines[i], usd); });
  // AC L14 3-ply substitution
  Object.assign(cells.AC[13], { p: 18.30, raw: '₹18.30', unit: '3 PLY on card', kind: 'doubt', sub: true, conf: 0.95 });
  cells.AC[13].steps = [['Read', 'AI', 'Rate card row "320*320*180 3 PLY" reads ₹18.30. We asked for 5-ply BC, 180/120/150/120/180.'], ['Calculate', 'Code', 'Per box, delivered. No conversion — but spec does not match.'], ['Verify', 'Check', 'Spec check failed: 3-ply offered where 5-ply asked.']];
  // AC L19 hand-corrected digit
  Object.assign(cells.AC[18], { p: 31.20, alt: 37.20, raw: '₹31.20 (or 37.20)', unit: 'hand-corrected', kind: 'doubt', ocr: true, conf: 0.61 });
  cells.AC[18].steps = [['Read', 'AI', 'Printed ₹34.50 is struck through; hand-written above it reads "31.20" (confidence 0.61). The first digit could be a 7.'], ['Calculate', 'Code', 'Priced as read: ₹31.20 per box.'], ['Verify', 'Check', 'Second read disagrees: "37.20". ₹37.20 would sit 14% above should-cost.']];

  const quoted = i => vendors.map(v => cells[v.id][i]).filter(c => c.p != null);
  const best = (i, elig) => { const q = quoted(i).filter(c => !elig || elig.includes(c.vid)).sort((a, b) => a.p - b.p); return q; };
  lines.forEach(l => { const b = best(l.i); l.win = b[0].vid; l.winP = b[0].p; l.second = b[1]; });

  // doubts
  const D = [];
  const st = (i, p, alt) => lines[i].qty * (alt - p);
  { const i = 13, ru = best(i)[1]; D.push({ id: 'D1', vid: 'AC', lines: [i], stake: lines[i].qty * (ru.p - 18.30), route: 'buyer', kind: 'Spec substitution',
    title: 'Anand offered 3-ply on L14 where 5-ply was asked', why: `Anand wins L14 at ₹18.30 only because the card prices a 3-ply box. The next 5-ply offer is ${VI[ru.vid].short} at ${inr(ru.p)}.`,
    ask: 'Judgement call: accept a 3-ply substitute for the exhaust fan carton, or price it out?',
    options: ['Reject the substitute (award goes to ' + VI[ru.vid].short + ')', 'Ask Anand to quote 5-ply', 'Accept 3-ply, with a note for QA'] }); }
  { const ls = [4, 10, 23]; let s = 0; ls.forEach(i => s += st(i, cells.VP[i].p, cells.VP[i].gross)); D.push({ id: 'D2', vid: 'VP', lines: ls, stake: s, route: 'vendor', kind: 'Conditional discount',
    title: 'Vardhman’s 2.5% discount applies only above ₹25 lakh per PO', why: 'The discount sits in footnote ‡ on page 3. Our monthly POs to one vendor run ₹14–18 lakh, so it may never apply. Without it, Vardhman loses L05, L11 and L24.',
    ask: 'Ask Vardhman whether the discount applies to the event value or to each PO.',
    email: { to: 'ritu.shah@vardhmanpackwell.in', subject: 'SE-2026-041 — footnote ‡ on your quote VPE/Q/2026/118', body: 'Dear Ritu,\n\nThank you for quotation VPE/Q/2026/118. Footnote ‡ offers 2.5% off on orders above ₹25 lakh per PO. Our releases are monthly, typically ₹14–18 lakh each.\n\nCould you confirm whether the discount is applied on the total annual award, or only on a single PO above ₹25 lakh?\n\nRegards,\nVikram Deshpande\nCategory Buyer, Packaging — Sahyadri Appliances' } }); }
  { const ls = lines.filter(l => l.win === 'RB' && l.second && l.second.p - l.winP < 0.38 && !(l.i >= 25 && l.print !== 'none')).map(l => l.i); let s = 0; ls.forEach(i => s += st(i, cells.RB[i].p, cells.RB[i].p + 0.38));
    D.push({ id: 'D3', vid: 'RB', lines: ls, stake: s, route: 'vendor', kind: 'Missing commercial term',
      title: `Rohit Box said "freight extra" — ${ls.length} wins depend on it`, why: `We added ₹0.42 per box from last year’s Pune → Chakan lane rate. If real freight is ₹0.80, Rohit Box loses ${ls.map(i => lines[i].id).join(', ')}.`,
      ask: 'Ask Rohit Box for freight per trip, or a delivered price.',
      email: { to: 'rohit@rohitbox.co.in', subject: 'SE-2026-041 — freight to Chakan', body: 'Dear Rohit ji,\n\nThanks for your rates (₹42/kg 5-ply, ₹38/kg 3-ply). You mentioned freight extra. To compare fairly, could you share either:\n\n• freight per trip, Pune to our Chakan plant (32 ft truck), or\n• a delivered price per kg.\n\nRegards,\nVikram Deshpande' } }); }
  { const i = 18; D.push({ id: 'D4', vid: 'AC', lines: [i], stake: st(i, 31.20, 37.20), route: 'vendor', kind: 'Unclear reading',
    title: 'Hand-corrected price on Anand’s card: ₹31.20 or ₹37.20?', why: `L19 is struck through and re-written by hand. Two independent reads disagree on the first digit. At ₹31.20 Anand wins; at ₹37.20 ${VI[best(i)[1].vid].short} does.`,
    ask: 'Ask Anand to confirm the L19 rate in writing.',
    email: { to: 'dilip@anandcartons.com', subject: 'SE-2026-041 — please confirm rate for juicer carton', body: 'Dear Dilip bhai,\n\nOn your rate card the juicer carton (380×300×320, 5-ply) is corrected by hand. Please confirm the rate per box in writing: ₹31.20 or ₹37.20?\n\nRegards,\nVikram' } }); }
  { const ls = lines.filter(l => l.i >= 25 && l.print !== 'none' && l.win === 'RB').map(l => l.i); if (ls.length) { let s = 0; ls.forEach(i => s += st(i, cells.RB[i].p, cells.RB[i].p + 1.10));
    D.push({ id: 'D5', vid: 'RB', lines: ls, stake: s, route: 'buyer', kind: '"Same as last year"',
      title: `"Rest same as last year" can’t cover ${ls.map(i => lines[i].id).join(', ')} — they’re new`, why: 'SE-2025-037 had no price for these SKUs. Print cost was taken from the nearest last-year spec. If it is printed 4-colour like its siblings, print runs up to ₹1.10 higher and Rohit Box loses.',
      ask: 'Judgement call: accept nearest-spec print cost, or ask Rohit Box to price these lines?', options: ['Accept nearest-spec print cost', 'Ask Rohit Box to price these lines'] }); } }
  D.sort((a, b) => b.stake - a.stake);
  D.forEach((d, k) => { d.rank = k + 1; d.vendor = VI[d.vid]; d.stakeL = lakh(d.stake); d.lineIds = d.lines.map(i => lines[i].id).join(', '); d.lines.forEach(i => { const c = cells[d.vid][i]; c.kind = 'doubt'; c.doubt = d.id; }); });
  const totalStake = D.reduce((s, d) => s + d.stake, 0);

  // out of range
  vendors.forEach(v => cells[v.id].forEach(c => { if (c.p == null) return; const r = c.p / lines[c.i].sc; c.ratio = r; c.dev = Math.round((r - 1) * 100);
    c.steps.push(['Verify', 'Check', `Should-cost ${inr(lines[c.i].sc)} — ${c.dev >= 0 ? '+' : '−'}${Math.abs(c.dev)}%${Math.abs(r - 1) > 0.12 ? ', outside the ±12% band' : ', inside the ±12% band'}`]);
    if (Math.abs(r - 1) > 0.12) { c.oor = true; if (c.kind !== 'doubt') c.kind = 'oor'; } }));

  function solve(elig) {
    let total = 0; const by = {}; vendors.forEach(v => by[v.id] = { lines: 0, value: 0 });
    const per = lines.map(l => { const b = best(l.i, elig)[0]; total += b.p * l.qty; by[b.vid].lines++; by[b.vid].value += b.p * l.qty; return { i: l.i, vid: b.vid, p: b.p, changed: b.vid !== l.win }; });
    return { per, total, by };
  }
  const baseline = solve(null), qual = solve(vendors.filter(v => v.q.cleared).map(v => v.id));

  const events = [
    { id: 'SE-2026-041', name: 'Corrugated boxes · FY27 H2', cat: 'Packaging', status: 'Comparing', lines: 30, vendors: '5 of 5 replied', value: baseline.total, due: 'Award by 15 Oct', note: `${D.length} doubts open`, current: true },
    { id: 'SE-2026-044', name: 'BOPP tape & stretch film', cat: 'Packaging', status: 'Collecting replies', lines: 12, vendors: '3 of 6 replied', value: 3820000, due: 'Closes 14 Oct', note: '3 awaiting' },
    { id: 'SE-2026-046', name: 'EPS foam inserts, fans', cat: 'Packaging', status: 'Drafting', lines: 18, vendors: 'Not sent', value: null, due: 'Send by 12 Oct', note: 'RFQ 70% drafted' },
    { id: 'SE-2026-038', name: 'Moulded pulp trays', cat: 'Packaging', status: 'Awaiting approval', lines: 6, vendors: '4 of 4 replied', value: 2140000, due: 'With VP since 6 Oct', note: 'Split award, 2 vendors' },
    { id: 'SE-2026-029', name: 'Printed manuals & warranty cards', cat: 'Print', status: 'Awarded', lines: 22, vendors: '5 of 5 replied', value: 1960000, due: 'Awarded 21 Aug 2026', note: 'Kalpana Offset' },
    { id: 'SE-2025-037', name: 'Corrugated boxes · FY26 H2', cat: 'Packaging', status: 'Awarded', lines: 25, vendors: '4 of 4 replied', value: 14120000, due: 'Awarded 14 Oct 2025', note: 'Rohit Box 14 lines, Shree Balaji 11', past: true },
    { id: 'SE-2026-019', name: 'Pallets, heat-treated', cat: 'Logistics', status: 'Closed', lines: 3, vendors: '2 of 5 replied', value: null, due: 'Closed 2 Jun 2026', note: 'Re-run as SE-2026-026' }
  ];

  window.KD = { FX, FXDATE, lines, vendors, VI, cells, doubts: D, totalStake, best, solve, baseline, qual, questions, answers, qPass, events, sbOrder, sbRow, short, inr, num, lakh, crore, loggedCount: 19,
    cell: (vid, i) => cells[vid][i] };
  window.dispatchEvent(new Event('kd-ready'));
})();
