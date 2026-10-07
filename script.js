/* =====================================================
   Barangay Tinorongan Document Request System (Prototype)
   All data is stored in JavaScript arrays (no database).
   Refreshing the page resets the data.
   ===================================================== */

// ---------- 1. DATA ("fake database") ----------
const STATUSES = ['Pending','Verified','Processing','Ready for Claiming','Released','Rejected'];
const FLOW = ['Pending','Verified','Processing','Ready for Claiming','Released'];
const DOC_TYPES = ['Barangay Certificate','Barangay Clearance','Certificate of Indigency','Barangay Business Permit','Other'];
const PURPOSES = ['Scholarship','Employment','School Requirement','Business','Legal Requirement','Personal'];

const ACCOUNTS = {
  resident: { email:'resident@gmail.com', pw:'123456' },
  staff:    { email:'staff@gmail.com',    pw:'123456' }
};

let ME = { name:'Maricar Barbon', address:'Purok 3, Tinorongan, Sagñay, Camarines Sur', email:'resident@gmail.com', phone:'09123456789' };

// owner:'resident' means it belongs to the logged-in demo resident
let requests = [
  {id:1, owner:'other',    resident:'Ana Santos',      address:'Purok 1, Tinorongan', doc:'Barangay Certificate', purpose:'School Enrollment', date:'2026-09-20', status:'Released',   appt:null},
  {id:2, owner:'resident', resident:'Maricar Barbon',  address:ME.address,            doc:'Barangay Certificate', purpose:'Scholarship',       date:'2026-10-01', status:'Processing', appt:null},
  {id:3, owner:'other',    resident:'Juan Dela Cruz',  address:'Purok 2, Tinorongan', doc:'Barangay Clearance',   purpose:'Employment',        date:'2026-10-04', status:'Pending',    appt:null},
  {id:4, owner:'other',    resident:'Carlo Reyes',     address:'Purok 5, Tinorongan', doc:'Barangay Business Permit', purpose:'Business',      date:'2026-10-05', status:'Verified',   appt:null},
  {id:5, owner:'resident', resident:'Maricar Barbon',  address:ME.address,            doc:'Barangay Certificate', purpose:'Scholarship',       date:'2026-09-15', status:'Released',   appt:null}
];
let appts = [ {reqId:2, date:'2026-10-10', time:'10:00', status:'Scheduled'} ];
requests[1].appt = appts[0];

let notifs = [
  {reqId:2, msg:'Your document is now being processed.', time:'Oct 6, 2026, 9:15 AM'},
  {reqId:2, msg:'Your request has been verified.',       time:'Oct 3, 2026, 2:30 PM'},
  {reqId:5, msg:'Your document has been released. Thank you!', time:'Sep 20, 2026, 11:00 AM'}
];
let logs = [
  {msg:'Staff changed Request #2 status from Verified to Processing.', time:'Oct 6, 2026, 9:15 AM'},
  {msg:'Staff changed Request #2 status from Pending to Verified.',    time:'Oct 3, 2026, 2:30 PM'},
  {msg:'Resident submitted Request #2.',                               time:'Oct 1, 2026, 8:00 AM'}
];
const users = [
  {name:'Maricar Barbon', email:'maricar@gmail.com', role:'Resident', status:'Active'},
  {name:'Ana Santos',     email:'ana@gmail.com',     role:'Resident', status:'Active'},
  {name:'Juan Dela Cruz', email:'juan@gmail.com',    role:'Resident', status:'Active'},
  {name:'Admin Staff',    email:'staff@gmail.com',   role:'Staff',    status:'Active'}
];

// ---------- 2. STATE & HELPERS ----------
let role = null;          // 'resident' or 'staff'
let page = 'dashboard';   // current sidebar page
let loginRole = 'resident';
let modalFn = null;       // function that builds the open modal's content (so it can refresh)
const checks = {};        // verification checklist state per request

const $ = id => document.getElementById(id);
const find = id => requests.find(r => r.id === id);
const rid = n => 'REQ-' + String(n).padStart(4,'0');
const badge = s => `<span class="badge-status st-${s.replace(/ /g,'')}">${s}</span>`;
const mine = () => requests.filter(r => r.owner === 'resident');
const count = (list, s) => list.filter(r => r.status === s).length;
const options = (arr, sel) => arr.map(o => `<option ${o===sel?'selected':''}>${o}</option>`).join('');
const nowStr = () => new Date().toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const fmtDate = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—';
const fmtTime = t => { if(!t) return '—'; let [h,m] = t.split(':'); h = +h; return `${h%12||12}:${m} ${h<12?'AM':'PM'}`; };
const today = () => new Date().toISOString().slice(0,10);

function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
}
function addNotif(reqId, msg){ notifs.unshift({reqId, msg, time:nowStr()}); }
function addLog(msg){ logs.unshift({msg, time:nowStr()}); }

// ---------- 3. LOGIN / LOGOUT ----------
function setLoginRole(r){
  loginRole = r;
  $('roleResident').classList.toggle('active', r==='resident');
  $('roleStaff').classList.toggle('active', r==='staff');
  $('email').value = ACCOUNTS[r].email;   // auto-fill demo account
  $('password').value = ACCOUNTS[r].pw;
  $('loginError').hidden = true;
}
function doLogin(e){
  e.preventDefault();
  const acc = ACCOUNTS[loginRole];
  if($('email').value.trim() === acc.email && $('password').value === acc.pw){
    role = loginRole; page = 'dashboard';
    $('loginView').hidden = true; $('appView').hidden = false;
    $('userName').textContent = role==='resident' ? ME.name : 'Admin Staff';
    renderSidebar(); render();
  } else {
    $('loginError').textContent = 'Wrong email or password for this role.';
    $('loginError').hidden = false;
  }
}
function logout(){
  role = null; $('appView').hidden = true; $('loginView').hidden = false;
  $('sidebar').classList.remove('open'); $('overlay').classList.remove('show');
  setLoginRole('resident');
}

// ---------- 4. SIDEBAR & NAVIGATION ----------
const NAV = {
  resident: [['dashboard','Dashboard','speedometer2'],['new','New Request','file-earmark-plus'],['myreq','My Requests','list-check'],
             ['appts','Appointments','calendar-event'],['notif','Notifications','bell'],['profile','Profile','person-circle']],
  staff:    [['dashboard','Dashboard','speedometer2'],['mgmt','Request Management','inbox'],['appts','Appointments','calendar-event'],
             ['docs','Documents','file-earmark-text'],['reports','Reports','bar-chart'],['users','Users','people'],['logs','System Logs','journal-text']]
};
function renderSidebar(){
  $('sidebar').innerHTML = `
    <div class="side-brand"><img src="assets/logo.png" alt="Logo"><b>BARANGAY TINORONGAN</b>
      <small>${role==='resident'?'Resident Portal':'Staff / Registrar'}</small></div>
    ${NAV[role].map(n => `<button class="nav-btn ${page===n[0]?'active':''}" onclick="go('${n[0]}')"><i class="bi bi-${n[2]}"></i>${n[1]}</button>`).join('')}
    <button class="nav-btn mt-auto" onclick="logout()"><i class="bi bi-box-arrow-left"></i>Logout</button>`;
}
function go(p){
  page = p; renderSidebar(); render();
  $('sidebar').classList.remove('open'); $('overlay').classList.remove('show');
  window.scrollTo(0,0);
}
function toggleSide(){ $('sidebar').classList.toggle('open'); $('overlay').classList.toggle('show'); }

// Re-draw current page (and open modal, if any)
function render(){
  $('content').innerHTML = PAGES[role][page]();
  if(modalFn) $('modalBody').innerHTML = modalFn();
}

// ---------- 5. MODAL HELPERS ----------
const modal = () => bootstrap.Modal.getOrCreateInstance($('mainModal'));
function showModal(title, fn){ modalFn = fn; $('modalTitle').textContent = title; $('modalBody').innerHTML = fn(); modal().show(); }
document.addEventListener('DOMContentLoaded', () => {
  $('mainModal').addEventListener('hidden.bs.modal', () => { modalFn = null; });
  setLoginRole('resident');
});

// ---------- 6. SMALL UI PIECES ----------
const title = (t, sub='') => `<h2 class="page-title">${t}</h2><p class="text-muted">${sub}</p>`;
const stat = (label, num, icon) => `<div class="col-6 col-md-4 col-xl"><div class="stat"><i class="bi bi-${icon}"></i><div class="num">${num}</div><div class="text-muted">${label}</div></div></div>`;

function timeline(status){
  if(status==='Rejected') return `<div class="alert alert-danger mb-0">This request was rejected.</div>`;
  const cur = FLOW.indexOf(status);
  return `<ul class="timeline">${FLOW.map((s,i) => `<li class="${i<cur?'done':i===cur?'current':''}">${s}${i===cur?' ← current':''}</li>`).join('')}</ul>`;
}

// Search + status filter (rows live in <tbody id="rows">)
function filterRows(){
  const q = ($('q')?.value || '').toLowerCase(), s = $('sf')?.value || '';
  document.querySelectorAll('#rows tr').forEach(tr => { tr.hidden = !(tr.dataset.t.includes(q) && (!s || tr.dataset.s === s)); });
}
const searchBar = withStatus => `<div class="row g-2 mb-3"><div class="col"><input id="q" class="form-control" placeholder="Search..." oninput="filterRows()"></div>
  ${withStatus ? `<div class="col-5 col-md-3"><select id="sf" class="form-select" onchange="filterRows()"><option value="">All statuses</option>${options(STATUSES)}</select></div>` : ''}</div>`;
const rowAttr = r => `data-t="${(rid(r.id)+r.resident+r.doc+r.purpose+r.status).toLowerCase()}" data-s="${r.status}"`;

// ---------- 7. PAGES ----------
const PAGES = { resident:{}, staff:{} };

/* ---- RESIDENT ---- */
PAGES.resident.dashboard = () => {
  const m = mine();
  const recent = [...m].sort((a,b)=>b.id-a.id).slice(0,3);
  return title(`Welcome, ${ME.name}!`, 'Request barangay documents anytime, anywhere.') +
  `<div class="row g-3 mb-3">${stat('Pending',count(m,'Pending'),'hourglass-split')}${stat('Processing',count(m,'Processing'),'gear')}
     ${stat('Ready for Claiming',count(m,'Ready for Claiming'),'box-seam')}${stat('Released',count(m,'Released'),'check2-circle')}</div>
   <div class="card-box"><div class="d-flex justify-content-between mb-2"><h5 class="mb-0">Recent Requests</h5>
     <button class="btn btn-sm btn-brand" onclick="go('new')"><i class="bi bi-plus-lg"></i> New Request</button></div>
     ${recent.map(r => `<div class="notif"><i class="bi bi-file-earmark-text"></i><div class="flex-grow-1"><b>${rid(r.id)}</b> — ${r.doc}<br>
       <small class="text-muted">Purpose: ${r.purpose}</small></div>${badge(r.status)}</div>`).join('') || '<p class="text-muted">No requests yet.</p>'}</div>`;
};

PAGES.resident.new = () => `${title('New Document Request','Fill in the form below and submit.')}
  <form class="card-box" onsubmit="submitRequest(event)" novalidate>
    <h6 class="text-green">Resident Information</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-6"><label class="form-label">Full Name</label><input id="fName" class="form-control" value="${ME.name}" required></div>
      <div class="col-md-6"><label class="form-label">Address</label><input id="fAddr" class="form-control" value="${ME.address}" required></div>
      <div class="col-md-6"><label class="form-label">Email</label><input id="fEmail" type="email" class="form-control" value="${ME.email}" required></div>
      <div class="col-md-6"><label class="form-label">Contact Number</label><input id="fPhone" class="form-control" value="${ME.phone}" pattern="[0-9+ ]{10,15}" required></div>
    </div>
    <h6 class="text-green">Request Details</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-6"><label class="form-label">Document Type</label><select id="fDoc" class="form-select" required><option value="">Choose...</option>${options(DOC_TYPES)}</select></div>
      <div class="col-md-6"><label class="form-label">Purpose</label><select id="fPurpose" class="form-select" required><option value="">Choose...</option>${options(PURPOSES)}</select></div>
      <div class="col-12"><label class="form-label">Additional Details</label><textarea id="fDetails" class="form-control" rows="2"></textarea></div>
      <div class="col-md-6"><label class="form-label">Preferred Appointment Date</label><input id="fDate" type="date" min="${today()}" class="form-control" required></div>
      <div class="col-md-6"><label class="form-label">Preferred Time</label><input id="fTime" type="time" class="form-control" required></div>
    </div>
    <button class="btn btn-brand" type="submit"><i class="bi bi-send"></i> Submit Request</button>
  </form>`;

function submitRequest(e){
  e.preventDefault();
  const f = e.target;
  if(!f.checkValidity()){ f.classList.add('was-validated'); toast('Please complete all required fields.'); return; }
  const id = requests.length + 1;   // automatic ID
  requests.push({id, owner:'resident', resident:$('fName').value.trim(), address:$('fAddr').value.trim(), doc:$('fDoc').value,
    purpose:$('fPurpose').value, details:$('fDetails').value, date:today(), status:'Pending', appt:null,
    pref:{date:$('fDate').value, time:$('fTime').value}});
  addLog(`Resident submitted Request #${id}.`);
  toast(`Request submitted successfully! ID: ${rid(id)} (Pending)`);
  go('myreq');
}

PAGES.resident.myreq = () => `${title('My Requests','Track the progress of your document requests.')}
  <div class="card-box">${searchBar(true)}<div class="table-wrap"><table class="table align-middle">
    <thead><tr><th>Request ID</th><th>Document</th><th>Purpose</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
    <tbody id="rows">${[...mine()].reverse().map(r => `<tr ${rowAttr(r)}><td>${rid(r.id)}</td><td>${r.doc}</td><td>${r.purpose}</td><td>${fmtDate(r.date)}</td>
      <td>${badge(r.status)}</td><td><button class="btn btn-sm btn-outline-success" onclick="viewRequest(${r.id})">View</button></td></tr>`).join('')}</tbody></table></div></div>`;

function viewRequest(id){
  showModal('Request Details', () => { const r = find(id); return `
    <div class="row g-3"><div class="col-md-6"><p><b>Request ID:</b> ${rid(r.id)}<br><b>Document:</b> ${r.doc}<br><b>Purpose:</b> ${r.purpose}<br>
      <b>Date Submitted:</b> ${fmtDate(r.date)}<br><b>Status:</b> ${badge(r.status)}<br>
      <b>Claiming Appointment:</b> ${r.appt ? fmtDate(r.appt.date)+' at '+fmtTime(r.appt.time) : 'Not yet scheduled'}</p></div>
      <div class="col-md-6"><h6>Progress</h6>${timeline(r.status)}</div></div>`; });
}

PAGES.resident.appts = () => {
  const list = appts.filter(a => find(a.reqId).owner === 'resident');
  return title('Appointments','Your document claiming schedules.') + `<div class="card-box table-wrap"><table class="table align-middle">
    <thead><tr><th>Request ID</th><th>Document</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(a => { const r = find(a.reqId); return `<tr><td>${rid(r.id)}</td><td>${r.doc}</td><td>${fmtDate(a.date)}</td><td>${fmtTime(a.time)}</td>
      <td><span class="badge-status st-Verified">${a.status}</span></td><td><button class="btn btn-sm btn-outline-success" onclick="viewRequest(${r.id})">View Details</button></td></tr>`; }).join('')
      || '<tr><td colspan="6" class="text-muted">No appointments yet.</td></tr>'}</tbody></table></div>`;
};

PAGES.resident.notif = () => {
  const list = notifs.filter(n => find(n.reqId).owner === 'resident');
  return title('Notifications','Updates about your requests.') + `<div class="card-box">
    ${list.map(n => `<div class="notif"><i class="bi bi-check-circle-fill"></i><div><div>${n.msg}</div>
      <small class="text-muted">${rid(n.reqId)} • ${n.time}</small></div></div>`).join('') || '<p class="text-muted">No notifications.</p>'}</div>`;
};

PAGES.resident.profile = () => title('Profile') + `<div class="card-box text-center" style="max-width:480px">
  <i class="bi bi-person-circle" style="font-size:5rem;color:var(--mid)"></i><h4>${ME.name}</h4>
  <p class="text-start mb-3"><b>Address:</b> ${ME.address}<br><b>Email:</b> ${ME.email}<br><b>Contact Number:</b> ${ME.phone}</p>
  <button class="btn btn-brand" onclick="editProfile()"><i class="bi bi-pencil"></i> Edit Profile</button></div>`;

function editProfile(){
  showModal('Edit Profile', () => `<form onsubmit="saveProfile(event)" novalidate>
    <label class="form-label">Full Name</label><input id="pName" class="form-control mb-2" value="${ME.name}" required>
    <label class="form-label">Address</label><input id="pAddr" class="form-control mb-2" value="${ME.address}" required>
    <label class="form-label">Email</label><input id="pEmail" type="email" class="form-control mb-2" value="${ME.email}" required>
    <label class="form-label">Contact Number</label><input id="pPhone" class="form-control mb-3" value="${ME.phone}" required>
    <button class="btn btn-brand">Save</button></form>`);
}
function saveProfile(e){
  e.preventDefault();
  if(!e.target.checkValidity()){ e.target.classList.add('was-validated'); return; }
  ME = {name:$('pName').value, address:$('pAddr').value, email:$('pEmail').value, phone:$('pPhone').value};
  $('userName').textContent = ME.name; modal().hide(); render(); toast('Profile updated.');
}

/* ---- STAFF ---- */
PAGES.staff.dashboard = () => {
  const L = requests;
  return title('Staff / Registrar Dashboard','Overview of all document requests.') +
  `<div class="row g-3 mb-3">${stat('Total Requests',L.length,'files')}${stat('Pending',count(L,'Pending'),'hourglass-split')}${stat('Processing',count(L,'Processing'),'gear')}
     ${stat('Ready for Claiming',count(L,'Ready for Claiming'),'box-seam')}${stat('Released',count(L,'Released'),'check2-circle')}${stat('Rejected',count(L,'Rejected'),'x-circle')}</div>
   <div class="card-box"><h5>Recent Requests</h5><div class="table-wrap"><table class="table align-middle"><thead><tr><th>ID</th><th>Resident</th><th>Document</th><th>Status</th><th></th></tr></thead>
   <tbody>${[...L].reverse().slice(0,5).map(r => `<tr><td>${rid(r.id)}</td><td>${r.resident}</td><td>${r.doc}</td><td>${badge(r.status)}</td>
     <td><button class="btn btn-sm btn-outline-success" onclick="openProcess(${r.id})">Manage</button></td></tr>`).join('')}</tbody></table></div></div>`;
};

PAGES.staff.mgmt = () => `${title('Staff / Registrar — Request Management','Change statuses, verify and process requests.')}
  <div class="card-box">${searchBar(true)}<div class="table-wrap"><table class="table align-middle">
  <thead><tr><th>ID</th><th>Resident</th><th>Document</th><th>Purpose</th><th>Status</th><th>Appointment</th><th>Actions</th></tr></thead>
  <tbody id="rows">${requests.map(r => `<tr ${rowAttr(r)}><td>${rid(r.id)}</td><td>${r.resident}</td><td>${r.doc}</td><td>${r.purpose}</td>
    <td>${badge(r.status)}<select class="form-select form-select-sm mt-1" onchange="setStatus(${r.id}, this.value)">${options(STATUSES, r.status)}</select></td>
    <td>${r.appt ? fmtDate(r.appt.date)+'<br>'+fmtTime(r.appt.time) : '—'}</td>
    <td><button class="btn btn-sm btn-brand" onclick="openProcess(${r.id})"><i class="bi bi-gear"></i> Process</button></td></tr>`).join('')}</tbody></table></div></div>`;

// Change a request's status (updates table, badge, resident notification, tracking page, logs)
function setStatus(id, s){
  const r = find(id), old = r.status;
  if(old === s) return;
  r.status = s;
  addLog(`Staff changed Request #${id} status from ${old} to ${s}.`);
  const msgs = {Verified:'Your request has been verified.', Processing:'Your document is now being processed.',
    'Ready for Claiming':'Your document is ready for claiming.', Released:'Your document has been released. Thank you!', Rejected:'Your request has been rejected.'};
  if(msgs[s]) addNotif(id, msgs[s]);
  if(s === 'Released' && r.appt) r.appt.status = 'Completed';
  toast(`${rid(id)} is now "${s}".`);
  render();
}

// Request Processing modal: details, checklist, document, appointment
function openProcess(id){
  if(!checks[id]) checks[id] = [0,1,2].map(() => find(id).status !== 'Pending');
  showModal('Request Processing — ' + rid(id), () => {
    const r = find(id), c = checks[id];
    const showDoc = ['Processing','Ready for Claiming','Released'].includes(r.status);
    return `
    <div class="row g-3">
     <div class="col-md-6"><p><b>Request ID:</b> ${rid(r.id)}<br><b>Resident:</b> ${r.resident}<br><b>Address:</b> ${r.address}<br>
       <b>Document:</b> ${r.doc}<br><b>Purpose:</b> ${r.purpose}<br><b>Date Submitted:</b> ${fmtDate(r.date)}<br><b>Status:</b> ${badge(r.status)}</p>
       <h6>Verification Checklist</h6>
       ${['Valid ID / Resident Record','Purpose Verified','Request Details Confirmed'].map((t,i) =>
         `<div class="form-check"><input class="form-check-input" type="checkbox" id="ck${i}" ${c[i]?'checked':''} onchange="checks[${id}][${i}]=this.checked"><label class="form-check-label" for="ck${i}">${t}</label></div>`).join('')}
       <div class="d-flex flex-wrap gap-2 mt-3">
         <button class="btn btn-brand btn-sm" ${r.status!=='Pending'?'disabled':''} onclick="verifyRequest(${id})"><i class="bi bi-patch-check"></i> Verify Request</button>
         <button class="btn btn-primary btn-sm" ${r.status!=='Verified'?'disabled':''} onclick="setStatus(${id},'Processing')">Start Processing</button>
         <button class="btn btn-outline-danger btn-sm" ${['Released','Rejected'].includes(r.status)?'disabled':''} onclick="setStatus(${id},'Rejected')">Reject</button>
       </div></div>
     <div class="col-md-6"><h6>Progress</h6>${timeline(r.status)}</div>
    </div>
    ${(r.status==='Processing'||r.status==='Ready for Claiming') ? `<hr><h6>Claiming Appointment</h6>
      <div class="row g-2 align-items-end"><div class="col-sm-4"><label class="form-label">Date</label><input type="date" id="apDate" min="${today()}" class="form-control" value="${r.appt?r.appt.date:''}"></div>
      <div class="col-sm-4"><label class="form-label">Time</label><input type="time" id="apTime" class="form-control" value="${r.appt?r.appt.time:''}"></div>
      <div class="col-sm-4"><button class="btn btn-gold w-100" onclick="scheduleAppt(${id})">Schedule Appointment</button></div></div>
      ${r.appt ? `<small class="text-success">Scheduled: ${fmtDate(r.appt.date)} at ${fmtTime(r.appt.time)}</small>` : ''}
      <div class="mt-3 d-flex gap-2 flex-wrap">
        ${r.status==='Processing' ? `<button class="btn btn-outline-primary btn-sm" onclick="setStatus(${id},'Ready for Claiming')">Mark Ready for Claiming</button>` : ''}
        ${r.status==='Ready for Claiming' ? `<button class="btn btn-brand btn-sm" onclick="setStatus(${id},'Released')">Mark as Released (claimed)</button>` : ''}
      </div>` : ''}
    ${showDoc ? `<hr><h6>Generated Document Preview</h6>${certHtml(r)}${docButtons()}` : ''}`;
  });
}
function verifyRequest(id){
  if(!checks[id].every(Boolean)){ toast('Please tick all checklist items first.'); return; }
  setStatus(id, 'Verified');
}
function scheduleAppt(id){
  const d = $('apDate').value, t = $('apTime').value;
  if(!d || !t){ toast('Please choose a date and time.'); return; }
  const r = find(id);
  if(r.appt){ r.appt.date = d; r.appt.time = t; r.appt.status = 'Scheduled'; }
  else { r.appt = {reqId:id, date:d, time:t, status:'Scheduled'}; appts.push(r.appt); }
  addNotif(id, `Your document claiming appointment is scheduled for ${fmtDate(d)} at ${fmtTime(t)}.`);
  addLog(`Staff scheduled Request #${id} appointment.`);
  toast('Appointment scheduled. Resident notified.');
  render();
}

// Certificate preview (placeholder content only)
function certHtml(r){
  return `<div class="cert">
    <img src="assets/logo.png" alt="Logo">
    <div class="mt-2"><b>REPUBLIC OF THE PHILIPPINES</b><br>PROVINCE OF CAMARINES SUR<br>MUNICIPALITY OF SAGÑAY<br><b>BARANGAY TINORONGAN</b></div>
    <h4>${r.doc.toUpperCase()}</h4>
    <p><b>TO WHOM IT MAY CONCERN:</b></p>
    <p>This is to certify that <b>${r.resident.toUpperCase()}</b>, of legal age, residing at ${r.address}, is a bona fide resident of Barangay Tinorongan, Sagñay, Camarines Sur.</p>
    <p>This certification is issued upon the request of the above-named person for the purpose of <b>${r.purpose.toUpperCase()}</b>.</p>
    <p>Issued this ${fmtDate(today())} at Barangay Tinorongan, Sagñay, Camarines Sur. <i>(Sample content — prototype only)</i></p>
    <div class="sign"><b>HON. JUAN P. DELA CRUZ</b><br>Punong Barangay</div></div>`;
}
const docButtons = () => `<div class="mt-3 d-flex gap-2"><button class="btn btn-brand btn-sm" onclick="downloadPdf()"><i class="bi bi-download"></i> Download PDF</button>
  <button class="btn btn-outline-secondary btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> Print</button></div>`;
function downloadPdf(){ toast('In the print window, choose "Save as PDF" as the printer.'); setTimeout(() => window.print(), 600); }

PAGES.staff.appts = () => title('Appointments','All claiming schedules.') + `<div class="card-box table-wrap"><table class="table align-middle">
  <thead><tr><th>Request ID</th><th>Resident</th><th>Document</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>
  ${appts.map(a => { const r = find(a.reqId); return `<tr><td>${rid(r.id)}</td><td>${r.resident}</td><td>${r.doc}</td><td>${fmtDate(a.date)}</td><td>${fmtTime(a.time)}</td>
    <td><span class="badge-status st-Verified">${a.status}</span></td></tr>`; }).join('') || '<tr><td colspan="6" class="text-muted">No appointments.</td></tr>'}</tbody></table></div>`;

PAGES.staff.docs = () => {
  const list = requests.filter(r => ['Processing','Ready for Claiming','Released'].includes(r.status));
  return title('Document Generation','Documents appear here once a request reaches Processing.') + `<div class="card-box table-wrap"><table class="table align-middle">
  <thead><tr><th>ID</th><th>Resident</th><th>Document</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(r => `<tr><td>${rid(r.id)}</td><td>${r.resident}</td><td>${r.doc}</td><td>${badge(r.status)}</td>
    <td><button class="btn btn-sm btn-brand" onclick="previewDoc(${r.id})">Preview</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-muted">No documents yet.</td></tr>'}</tbody></table></div>`;
};
function previewDoc(id){ showModal('Generated Document Preview', () => certHtml(find(id)) + docButtons()); }

/* Reports */
PAGES.staff.reports = () => title('Reports','Filter and summarize requests.') + `<div class="card-box"><div class="row g-2 align-items-end">
  <div class="col-6 col-md-2"><label class="form-label">Date From</label><input type="date" id="rFrom" class="form-control"></div>
  <div class="col-6 col-md-2"><label class="form-label">Date To</label><input type="date" id="rTo" class="form-control"></div>
  <div class="col-6 col-md-3"><label class="form-label">Document Type</label><select id="rDoc" class="form-select"><option value="">All</option>${options(DOC_TYPES)}</select></div>
  <div class="col-6 col-md-3"><label class="form-label">Status</label><select id="rStatus" class="form-select"><option value="">All</option>${options(STATUSES)}</select></div>
  <div class="col-12 col-md-2"><button class="btn btn-brand w-100" onclick="genReport()">Generate Report</button></div></div></div>
  <div id="repOut">${reportBody(requests)}</div>
  <div class="card-box"><h5>Recent Reports</h5><div class="notif"><i class="bi bi-file-earmark-bar-graph"></i> Request Summary Report</div>
    <div class="notif"><i class="bi bi-file-earmark-bar-graph"></i> Released Documents Report</div></div>`;

function reportBody(list){
  const max = Math.max(1, ...FLOW.map(s => count(list, s)));
  return `<div class="row g-3 mb-3">${stat('Total Requests',list.length,'files')}${stat('Pending',count(list,'Pending'),'hourglass-split')}${stat('Processing',count(list,'Processing'),'gear')}
    ${stat('Ready for Claiming',count(list,'Ready for Claiming'),'box-seam')}${stat('Released',count(list,'Released'),'check2-circle')}</div>
    <div class="card-box"><h5>Requests by Status</h5>${FLOW.map(s => `<div class="bar-row"><span>${s}</span><div class="bar" style="width:${count(list,s)/max*60}%"></div><b>${count(list,s)}</b></div>`).join('')}</div>`;
}
function genReport(){
  const f = $('rFrom').value, t = $('rTo').value, d = $('rDoc').value, s = $('rStatus').value;
  const list = requests.filter(r => (!f || r.date >= f) && (!t || r.date <= t) && (!d || r.doc === d) && (!s || r.status === s));
  $('repOut').innerHTML = reportBody(list); toast('Report generated.');
}

PAGES.staff.users = () => title('Users') + `<div class="card-box table-wrap"><table class="table align-middle">
  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
  ${users.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td><span class="badge-status st-Verified">${u.status}</span></td>
    <td><button class="btn btn-sm btn-outline-secondary" onclick="toast('Demo only: user editing is not included in the prototype.')">Edit</button></td></tr>`).join('')}</tbody></table></div>`;

PAGES.staff.logs = () => title('System Logs','Recent system activity.') + `<div class="card-box">
  ${logs.map(l => `<div class="notif"><i class="bi bi-journal-text"></i><div>${l.msg}<br><small class="text-muted">${l.time}</small></div></div>`).join('')}</div>`;
