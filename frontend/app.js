const accounts = {
  customer: { email: 'customer@storespace.vn', password: '123456', name: 'Nguyễn Minh Anh', role: 'Storage Customer', initials: 'MA', permissions: ['dashboard', 'my-units', 'reservations', 'payments', 'support'], facilityIds: ['*'] },
  staff: { email: 'staff@storespace.vn', password: '123456', name: 'Trần Quốc Huy', role: 'Facility Staff', initials: 'QH', permissions: ['dashboard', 'check-in', 'returns', 'support', 'daily-tasks'], facilityIds: ['F01'] },
  fm: { email: 'manager@storespace.vn', password: '123456', name: 'Lê Hoàng Nam', role: 'Facility Manager', initials: 'LN', permissions: ['dashboard', 'units', 'customers', 'contracts', 'staff', 'reports', 'operations', 'revenue'], facilityIds: ['F01'] },
  bom: { email: 'operations@storespace.vn', password: '123456', name: 'Phạm Thu Hà', role: 'Business Operations Manager', initials: 'TH', permissions: ['dashboard', 'facilities', 'policies', 'fees', 'reports', 'revenue'], facilityIds: ['*'] },
  admin: { email: 'admin@storespace.vn', password: '123456', name: 'System Administrator', role: 'System Administrator', initials: 'SA', permissions: ['dashboard', 'users', 'roles', 'permissions', 'activity', 'system'], facilityIds: ['*'] }
};

function loadAccounts() {
  try {
    const raw = localStorage.getItem('storespace_accounts');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') { Object.assign(accounts, saved) }
  } catch (e) { console.warn('Cannot load accounts', e) }
}
function saveAccounts() { try { localStorage.setItem('storespace_accounts', JSON.stringify(accounts)) } catch (e) { console.warn('Cannot save accounts', e) } }
const ROLE_PERMISSIONS = {
  'Storage Customer': ['dashboard', 'my-units', 'reservations', 'payments', 'support'],
  'Facility Staff': ['dashboard', 'check-in', 'returns', 'support', 'daily-tasks'],
  'Facility Manager': ['dashboard', 'units', 'customers', 'contracts', 'staff', 'reports', 'operations', 'revenue'],
  'Business Operations Manager': ['dashboard', 'facilities', 'policies', 'fees', 'reports', 'revenue'],
  'System Administrator': ['dashboard', 'users', 'roles', 'permissions', 'activity', 'system']
};
const SELF_REQUESTABLE_ROLES = ['Storage Customer', 'Facility Staff', 'Facility Manager', 'Business Operations Manager'];
function accountPermissionsForCustomer() { return [...ROLE_PERMISSIONS['Storage Customer']] }
function accountPermissionsForRole(role) { return [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Storage Customer'])] }
function normalizeAccounts() {
  Object.values(accounts).forEach(a => {
    if (!a.status) a.status = 'Active';
    if (!a.permissions) a.permissions = accountPermissionsForRole(a.role); if (a.role === 'Facility Manager' && !a.permissions.includes('revenue')) a.permissions.push('revenue');
    if (a.requestedRole === undefined) a.requestedRole = null;
    if (a.approvalStatus === undefined) a.approvalStatus = 'Approved';
    if (a.restrictions === undefined) a.restrictions = [];
    if (!Array.isArray(a.facilityIds)) a.facilityIds = a.role === 'Business Operations Manager' || a.role === 'System Administrator' ? ['*'] : [];
  });
}
function openRegisterModal() { const m = $('registerModal'); if (!m) return; closeLoginModal(); m.classList.add('show'); $('registerError').textContent = ''; $('registerForm').reset(); setTimeout(() => $('registerName').focus(), 50) }
function closeRegisterModal() { $('registerModal')?.classList.remove('show') }
async function registerCustomer(e) {
  e.preventDefault();
  const name = $('registerName').value.trim(), email = $('registerEmail').value.trim().toLowerCase(), password = $('registerPassword').value, confirm = $('registerConfirm').value, requestedRole = $('registerRole').value;
  const err = $('registerError');
  if (name.length < 2) { err.textContent = 'Vui lòng nhập họ và tên.'; return }
  if (!email) { err.textContent = 'Vui lòng nhập email.'; return }
  if (password.length < 6) { err.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.'; return }
  if (password !== confirm) { err.textContent = 'Mật khẩu xác nhận không khớp.'; return }
  if (!SELF_REQUESTABLE_ROLES.includes(requestedRole)) { err.textContent = 'Role đăng ký không hợp lệ.'; return }

  try {
    const res = await fetch('http://localhost:5046/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name, email: email, password: password, roleName: requestedRole })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.message || 'Đăng ký thất bại'; return; }

    closeRegisterModal();
    $('email').value = email; $('password').value = '';
    openLoginModal(data.message);
    showToast(data.message);
  } catch (error) {
    err.textContent = 'Lỗi kết nối tới Backend. Hãy chắc chắn Backend đang chạy.';
  }
}

const navDefinitions = {
  dashboard: ['▦', 'Dashboard'], myUnits: ['▣', 'Kho của tôi'], reservations: ['◷', 'Đặt kho'], payments: ['₫', 'Thanh toán'],
  'check-in': ['⇥', 'Check-in / Bàn giao'], returns: ['↩', 'Trả kho / Kiểm tra'], support: ['?', 'Hỗ trợ'], 'daily-tasks': ['☑', 'Công việc hôm nay'],
  units: ['▤', 'Quản lý kho'], customers: ['♙', 'Khách hàng'], contracts: ['▤', 'Hợp đồng'], staff: ['♧', 'Nhân viên'], reports: ['◫', 'Báo cáo'], operations: ['◈', 'Vận hành'],
  facilities: ['⌂', 'Cơ sở'], policies: ['⚙', 'Chính sách'], fees: ['₫', 'Biểu phí'], revenue: ['◔', 'Doanh thu toàn hệ thống'], users: ['♙', 'Tài khoản'], roles: ['◇', 'Vai trò'], permissions: ['◉', 'Phân quyền'], activity: ['◌', 'Activity Logs'], system: ['⚙', 'System Settings']
};

let currentUser = null, currentPage = 'dashboard', pendingAuthAction = null;

const state = {
  facilities: [
    { id: 'F01', name: 'Central District', address: 'District 1, HCMC', status: 'Active', locations: ['Khu A', 'Khu B', 'Tầng 2'] },
    { id: 'F02', name: 'Thảo Điền', address: 'Thu Duc, HCMC', status: 'Active', locations: ['Khu A', 'Khu B', 'Tầng 1'] }
  ],
  units: [
    { id: 'A-101', facility: 'F01', type: 'Kho thường', climate: 'Kho thường', size: '4 m²', price: 1200000, status: 'Available', location: 'Khu A' },
    { id: 'A-102', facility: 'F01', type: 'Kho thường', climate: 'Kho thường', size: '4 m²', price: 1200000, status: 'Available', location: 'Khu A' },
    { id: 'A-204', facility: 'F01', type: 'Kho mát', climate: 'Kho mát', size: '6 m²', price: 1700000, status: 'Available', location: 'Khu B' },
    { id: 'B-112', facility: 'F01', type: 'Kho thường', climate: 'Kho thường', size: '2 m²', price: 800000, status: 'Available', location: 'Khu B' },
    { id: 'C-305', facility: 'F01', type: 'Kho lạnh', climate: 'Kho lạnh', size: '10 m²', price: 2800000, status: 'Available', location: 'Tầng 2' },
    { id: 'TD-01', facility: 'F02', type: 'Kho mát', climate: 'Kho mát', size: '4 m²', price: 1300000, status: 'Available', location: 'Khu A' }
  ],
  bookings: [], contracts: [], payments: [], paymentSchedules: [], handovers: [], returns: [], renewals: [], support: [], extraCharges: [], activities: [], notifications: [], staffAssignments: [],
  policies: { depositMonths: 2, cancellationHours: 24, overdueDaily: 100000, renewalFee: 0, damageDepositHold: true, feeWaiverEnabled: true, feeWaiverMaxPercent: 100 },
  fees: { discountPercent: 0, extraAccessCard: 150000, lockReplacement: 300000, repairMinimum: 200000 }
};

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const money = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + ' ₫';
const nowISO = () => new Date().toISOString();
const timeText = () => new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function showToast(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast = setTimeout(() => t.classList.remove('show'), 2800) }
function saveState() { try { localStorage.setItem('storespace_state', JSON.stringify(state)) } catch (e) { console.warn('Cannot save demo state', e) } }
function loadState() { try { const raw = localStorage.getItem('storespace_state'); if (!raw) return; const saved = JSON.parse(raw); Object.keys(state).forEach(k => { if (saved[k] !== undefined) state[k] = saved[k] }) } catch (e) { console.warn('Cannot load demo state', e) } }
function activityIsFinancial(text) { return /(thanh toán|đặt cọc|tiền thuê|phí |phí\b|doanh thu|sửa chữa|gia hạn|renewal|revenue|deposit|payment|refund|hoàn cọc)/i.test(String(text || '')) }
function activityContext(text) {
  const t = String(text || '');
  const bookingId = (t.match(/BKO\d+/i) || [])[0];
  const contractId = (t.match(/CT\d+/i) || [])[0];
  const renewalId = (t.match(/REN\d+/i) || [])[0];
  const chargeId = (t.match(/CHG\d+/i) || [])[0];
  const scheduleId = (t.match(/SCH\d+/i) || [])[0];
  let facilityId = null, customer = null, unitId = null;
  const b = bookingId && getBooking(bookingId);
  const c = contractId && getContract(contractId);
  const r = renewalId && state.renewals?.find(x => x.id === renewalId);
  const ch = chargeId && state.extraCharges?.find(x => x.id === chargeId);
  const sch = scheduleId && state.paymentSchedules?.find(x => x.id === scheduleId);
  if (b) { facilityId = b.facility; customer = b.customer; unitId = b.unitId }
  else if (c) { const u = getUnit(c.unitId); facilityId = u?.facility || null; customer = c.customer; unitId = c.unitId }
  else if (r) { const cc = getContract(r.contractId), u = cc && getUnit(cc.unitId); facilityId = u?.facility || null; customer = r.customer; unitId = cc?.unitId || null }
  else if (ch) { const cc = ch.contractId && getContract(ch.contractId), u = cc && getUnit(cc.unitId); facilityId = u?.facility || null; customer = ch.customer; unitId = cc?.unitId || null }
  else if (sch) { const cc = getContract(sch.contractId), u = cc && getUnit(cc.unitId); facilityId = u?.facility || null; customer = sch.customer; unitId = cc?.unitId || null }
  if (!facilityId) {
    const f = state.facilities?.find(f => t.toLowerCase().includes(String(f.name || '').toLowerCase()));
    if (f) facilityId = f.id;
  }
  if (!unitId) {
    const u = state.units?.find(u => new RegExp('\\b' + String(u.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(t));
    if (u) { unitId = u.id; facilityId = facilityId || u.facility }
  }
  if (!customer) { const email = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i) || [])[0]; if (email && email !== currentUser?.email) customer = email }
  return { bookingId, contractId, renewalId, chargeId, scheduleId, facilityId, customer, unitId };
}
function addActivity(text, meta = {}) {
  state.activities = state.activities || [];
  const ctx = activityContext(text);
  const item = { id: 'ACT' + Date.now() + Math.random().toString(16).slice(2), text, time: timeText(), actorEmail: meta.actorEmail || currentUser?.email || null, actorRole: meta.actorRole || currentUser?.role || null, customer: meta.customer !== undefined ? meta.customer : (ctx.customer || null), facilityId: meta.facilityId !== undefined ? meta.facilityId : (ctx.facilityId || null), unitId: meta.unitId !== undefined ? meta.unitId : (ctx.unitId || null), bookingId: meta.bookingId !== undefined ? meta.bookingId : (ctx.bookingId || null), contractId: meta.contractId !== undefined ? meta.contractId : (ctx.contractId || null), financial: meta.financial !== undefined ? meta.financial : activityIsFinancial(text), category: meta.category || 'activity' };
  state.activities.unshift(item); saveState();
}
function addNotification(role, text, bookingId = null, kind = 'general', targetEmail = null, facilityId = null) {
  state.notifications = state.notifications || [];
  const b = bookingId && getBooking(bookingId);
  const target = targetEmail || ((role === 'Storage Customer') ? b?.customer : null);
  const fid = facilityId || b?.facility || null;
  state.notifications.unshift({ id: 'N' + Date.now() + Math.random().toString(16).slice(2), role, bookingId, facilityId: fid, targetEmail: target, kind, text, time: timeText(), read: false }); saveState();
}
function activityVisibleToCurrentUser(a) {
  if (!currentUser) return false;
  if (currentUser.role === 'System Administrator') return !a.financial;
  if (currentUser.role === 'Storage Customer') return a.actorEmail === currentUser.email || a.customer === currentUser.email;
  if (currentUser.role === 'Facility Staff') return !a.financial && (a.actorEmail === currentUser.email || hasFacilityAccess(a.facilityId));
  if (currentUser.role === 'Facility Manager') return a.actorEmail === currentUser.email || hasFacilityAccess(a.facilityId);
  if (currentUser.role === 'Business Operations Manager') return true;
  return a.actorEmail === currentUser.email;
}
function visibleActivities(limit = 6) { return (state.activities || []).filter(activityVisibleToCurrentUser).slice(0, limit) }
function visibleNotifications() {
  if (!currentUser) return [];
  return (state.notifications || []).filter(n => {
    if (n.targetEmail) return n.targetEmail === currentUser.email;
    if (n.role !== currentUser.role) return false;
    if (n.bookingId) { const b = getBooking(n.bookingId); if (b) { if (currentUser.role === 'Storage Customer') return b.customer === currentUser.email; if (['Facility Staff', 'Facility Manager'].includes(currentUser.role)) return hasFacilityAccess(b.facility) } }
    if (n.facilityId && ['Facility Staff', 'Facility Manager'].includes(currentUser.role)) return hasFacilityAccess(n.facilityId);
    return currentUser.role === 'Business Operations Manager' || currentUser.role === 'System Administrator';
  });
}
function activityHTML() { const a = visibleActivities(6); return a.length ? a.map(x => `<div class="activity"><i class="activity-dot"></i><div><strong>${esc(x.text)}</strong><span>${x.time} · StoreSpace</span></div></div>`).join('') : '<div class="empty-state">Chưa có hoạt động liên quan.</div>' }
function supportFacilityId(s) { const b = state.bookings.find(b => b.customer === s.customer && ['Pending Deposit', 'Pending Verification', 'Pending Approval', 'Approved', 'Paid', 'Handed Over'].includes(b.status)); if (b) return b.facility; const c = state.contracts.find(c => c.customer === s.customer && ['Active', 'Return Requested', 'Damage Review'].includes(c.status)); return c ? getUnit(c.unitId)?.facility : null }

function getFacility(id) { return state.facilities.find(x => x.id === id) }
function getUnit(id) { return state.units.find(x => x.id === id) }
function getBooking(id) { return state.bookings.find(x => x.id === id) }
function getContract(id) { return state.contracts.find(x => x.id === id) }
function dateOverlap(aStart, aEnd, bStart, bEnd) {
  const a1 = new Date(`${aStart}T00:00:00`), a2 = new Date(`${aEnd}T23:59:59`), b1 = new Date(`${bStart}T00:00:00`), b2 = new Date(`${bEnd}T23:59:59`);
  return !Number.isNaN(a1.getTime()) && !Number.isNaN(a2.getTime()) && !Number.isNaN(b1.getTime()) && !Number.isNaN(b2.getTime()) && a1 <= b2 && b1 <= a2;
}
function unitHasOverlap(unitId, start, end, excludeBookingId = null) {
  const activeBookingStates = ['Pending Deposit', 'Pending Verification', 'Pending Approval', 'Approved', 'Paid', 'Handed Over'];
  const bookingConflict = state.bookings.some(b => b.unitId === unitId && b.id !== excludeBookingId && activeBookingStates.includes(b.status) && dateOverlap(start, end, b.start, b.end));
  const contractConflict = state.contracts.some(c => c.unitId === unitId && c.id !== excludeBookingId && ['Active', 'Return Requested', 'Damage Review'].includes(c.status) && dateOverlap(start, end, c.start, c.end));
  return bookingConflict || contractConflict;
}
function isUnitAvailableForPeriod(unit, start, end, excludeBookingId = null) {
  if (!unit || ['Maintenance', 'Rented'].includes(unit.status)) return false;
  return !unitHasOverlap(unit.id, start, end, excludeBookingId);
}
function refreshDemoState() { loadState(); normalizeState(); }
function nextId(prefix, list) { return prefix + String((list?.length || 0) + 1).padStart(3, '0') }
function roleIs(role) { return currentUser?.role === role }
function hasFacilityAccess(facilityId, user = currentUser) { if (!user) return false; if (user.role === 'Business Operations Manager' || user.role === 'System Administrator') return true; return (user.facilityIds || []).includes('*') || (user.facilityIds || []).includes(facilityId) }
function facilityScopedUnits() { return roleIs('Facility Manager') ? (state.units || []).filter(u => hasFacilityAccess(u.facility)) : state.units || [] }
function facilityScopedBookings() { return roleIs('Facility Manager') ? (state.bookings || []).filter(b => hasFacilityAccess(b.facility)) : state.bookings || [] }
function can(page) { return !!currentUser?.permissions.includes(page) }
function climateOf(u) { return u?.climate || u?.type || 'Kho thường' }
function sizeNumber(s) { return Number(String(s || '').replace(/[^0-9.]/g, '')) || 0 }
function localDateInputValue(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addOneMonthToDateInput(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + 1);
  return localDateInputValue(d);
}
function bookingStartWindow() {
  const min = localDateInputValue(new Date());
  const max = addOneMonthToDateInput(min);
  return { min, max };
}
function isValidBookingStart(start) {
  const { min, max } = bookingStartWindow();
  return !!start && start >= min && start <= max;
}

function paymentCodeFor(b) {
  if (!b.rentPaymentCode) b.rentPaymentCode = `SS-${b.id}-${String(b.unitId).replace(/[^A-Za-z0-9]/g, '')}`.toUpperCase();
  return b.rentPaymentCode;
}
function renewalCodeFor(r) { if (!r.paymentCode) r.paymentCode = `SS-${r.id}-${String(r.contractId).replace(/[^A-Za-z0-9]/g, '')}`.toUpperCase(); return r.paymentCode }
function scheduleCodeFor(s) { if (!s.paymentCode) s.paymentCode = `SS-${s.id}-${String(s.contractId).replace(/[^A-Za-z0-9]/g, '')}`.toUpperCase(); return s.paymentCode }
function qrSvgFor(code) {
  let seed = 0; for (let i = 0; i < code.length; i++)seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
  const n = 21, cell = 5, size = n * cell, bits = [];
  for (let y = 0; y < n; y++) { bits[y] = []; for (let x = 0; x < n; x++) { seed = (seed * 1664525 + 1013904223) >>> 0; bits[y][x] = ((seed >>> 29) & 1) === 1; } }
  const finder = (ox, oy) => { for (let y = 0; y < 7; y++)for (let x = 0; x < 7; x++) { const edge = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4; if (ox + x < n && oy + y < n) bits[oy + y][ox + x] = edge || core; } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  const rects = []; for (let y = 0; y < n; y++)for (let x = 0; x < n; x++)if (bits[y][x]) rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR ${esc(code)}"><rect width="100%" height="100%" fill="white"/>${rects.join('')}</svg>`;
}

/* Keep the demo data consistent when moving between roles/pages. */
function ensureStaffNotifications() {
  state.notifications = state.notifications || [];
  const paidBookings = state.bookings.filter(b => b.status === 'Paid' && !state.handovers.some(h => h.bookingId === b.id));
  paidBookings.forEach(b => {
    const exists = state.notifications.some(n => n.role === 'Facility Staff' && n.bookingId === b.id && n.kind === 'handover' && !n.read);
    if (!exists) state.notifications.unshift({ id: 'N' + Date.now() + Math.random().toString(16).slice(2), role: 'Facility Staff', bookingId: b.id, kind: 'handover', text: `Booking ${b.id} · ${b.unitId} đã thanh toán tiền thuê, sẵn sàng check-in & bàn giao.`, time: timeText(), read: false });
  });
  saveState();
}
function normalizeState() {
  ['bookings', 'contracts', 'payments', 'paymentSchedules', 'handovers', 'returns', 'renewals', 'support', 'extraCharges', 'activities', 'notifications', 'staffAssignments'].forEach(k => { if (!Array.isArray(state[k])) state[k] = [] });
  state.activities = (state.activities || []).map(a => { if (a.financial === undefined) a.financial = activityIsFinancial(a.text); if (a.actorEmail === undefined) a.actorEmail = null; if (a.actorRole === undefined) a.actorRole = null; const ctx = activityContext(a.text); if (a.customer === undefined || a.customer === null) a.customer = ctx.customer || null; if (!a.facilityId) a.facilityId = ctx.facilityId || null; if (!a.unitId) a.unitId = ctx.unitId || null; if (!a.bookingId) a.bookingId = ctx.bookingId || null; if (!a.contractId) a.contractId = ctx.contractId || null; if (!a.category) a.category = 'activity'; return a });
  state.notifications = (state.notifications || []).map(n => { if (!n.facilityId && n.bookingId) n.facilityId = getBooking(n.bookingId)?.facility || null; if (!n.targetEmail && n.role === 'Storage Customer' && n.bookingId) n.targetEmail = getBooking(n.bookingId)?.customer || null; return n });
  state.facilities = (state.facilities || []).map((f, i) => { if (!Array.isArray(f.locations) || !f.locations.length) f.locations = i === 0 ? ['Khu A', 'Khu B', 'Tầng 2'] : ['Khu A', 'Khu B', 'Tầng 1']; return f });
  state.units = (state.units || []).map(u => { if (!u.location) { const f = getFacility(u.facility); u.location = f?.locations?.[0] || 'Khu A' } return u });
  state.policies = Object.assign({ depositMonths: 2, cancellationHours: 24, overdueDaily: 100000, renewalFee: 0, damageDepositHold: true, feeWaiverEnabled: true, feeWaiverMaxPercent: 100 }, state.policies || {});
  state.fees = Object.assign({ discountPercent: 0, extraAccessCard: 150000, lockReplacement: 300000, repairMinimum: 200000 }, state.fees || {});
  /* Recover old v8/v9 demo records: a successful rent payment is authoritative. */
  state.payments.filter(p => p.kind === 'rent' && p.status === 'Success').forEach(p => { const b = getBooking(p.bookingId); if (b && !b.rentPaymentPaid) { b.rentPaymentPaid = true; b.rentPaidAmount = p.amount; b.rentPaymentCode = p.paymentCode || paymentCodeFor(b); b.rentPaymentStatus = 'Paid'; b.handoverReady = true; b.status = 'Paid'; } });
  ensureStaffNotifications();
  saveState();
}

function openLoginModal(message = '') {
  const overlay = $('loginPage'); if (!overlay) return;
  overlay.classList.remove('hidden'); overlay.classList.add('show');
  $('loginError').textContent = message || '';
  setTimeout(() => $('email')?.focus(), 80);
}
function closeLoginModal() {
  const overlay = $('loginPage'); if (!overlay) return;
  overlay.classList.remove('show'); overlay.classList.add('hidden');
  $('loginError').textContent = '';
}
function requireLogin(action = null) {
  if (currentUser) return true;
  pendingAuthAction = action; openLoginModal('Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục.'); return false;
}
function login(account) {
  loadState(); normalizeState(); normalizeAccounts();
  const candidate = accounts[account];
  if (!candidate) return;
  if (candidate.status === 'Banned') { $('loginError').textContent = 'Tài khoản đã bị khóa bởi System Administrator.'; return }
  if (candidate.status === 'Suspended') { $('loginError').textContent = 'Tài khoản đang bị tạm ngưng. Vui lòng liên hệ System Administrator.'; return }
  if (candidate.status === 'Pending Approval') { $('loginError').textContent = `Yêu cầu role ${candidate.requestedRole || candidate.role} đang chờ System Administrator duyệt.`; return }
  if (candidate.status === 'Rejected') { $('loginError').textContent = 'Yêu cầu tài khoản chưa được phê duyệt. Vui lòng liên hệ System Administrator.'; return }
  currentUser = candidate; localStorage.setItem('storespace_user', account); addActivity(`Login: ${candidate.email} · ${candidate.role}`, { actorEmail: candidate.email, actorRole: candidate.role, financial: false, category: 'login' });
  closeLoginModal(); $('landingPage').classList.add('hidden'); $('appPage').classList.remove('hidden');
  $('userName').textContent = currentUser.name; $('userRole').textContent = currentUser.role; $('userAvatar').textContent = currentUser.initials;
  buildNav(); renderPage('dashboard');
  const action = pendingAuthAction; pendingAuthAction = null;
  if (action?.type === 'book' && currentUser.role === 'Storage Customer') setTimeout(() => openBookingModal(action.unitId), 120);
  else if (action?.type === 'login-only') showToast('Đăng nhập thành công.');
}
function buildNav() {
  const nav = $('sideNav'); nav.innerHTML = '';
  const groups = [{ title: 'WORKSPACE', keys: currentUser.permissions.slice(0, 4) }, { title: 'MANAGEMENT', keys: currentUser.permissions.slice(4) }];
  groups.forEach(g => { if (!g.keys.length) return; const label = document.createElement('div'); label.className = 'eyebrow'; label.style.margin = '14px 11px 6px'; label.textContent = g.title; nav.appendChild(label); g.keys.forEach(key => { const def = navDefinitions[key]; if (!def) return; const b = document.createElement('button'); b.className = 'side-link'; b.dataset.page = key; b.innerHTML = `<span>${def[0]}</span>${def[1]}`; b.onclick = () => renderPage(key); nav.appendChild(b) }) });
}
function labels() { return { dashboard: 'Dashboard', myUnits: 'Kho của tôi', reservations: 'Đặt kho', payments: 'Thanh toán', 'check-in': 'Check-in / Bàn giao', returns: 'Trả kho / Kiểm tra', support: 'Hỗ trợ', 'daily-tasks': 'Công việc hôm nay', units: 'Quản lý kho', customers: 'Khách hàng', contracts: 'Hợp đồng', staff: 'Nhân viên', reports: 'Báo cáo', operations: 'Vận hành', facilities: 'Cơ sở', policies: 'Chính sách', fees: 'Biểu phí', revenue: 'Doanh thu', users: 'Tài khoản', roles: 'Vai trò', permissions: 'Phân quyền', activity: 'Activity Logs', system: 'System Settings', settings: 'Settings' } }
function renderPage(page) {
  currentPage = page; document.querySelectorAll('.side-link').forEach(x => x.classList.toggle('active', x.dataset.page === page));
  const title = labels()[page] || 'Dashboard'; $('currentPageName').textContent = title; $('roleEyebrow').textContent = currentUser.role.toUpperCase();
  $('pageTitle').textContent = page === 'dashboard' ? greeting() : title; $('pageSubtitle').textContent = page === 'dashboard' ? subtitleByRole() : 'Thao tác thật trên dữ liệu demo sẽ ảnh hưởng đến các vai trò và case liên quan.';
  $('primaryAction').textContent = primaryActionFor(page); $('dashboardContent').innerHTML = page === 'dashboard' ? dashboardByRole() : genericPage(page); $('primaryAction').onclick = () => primaryAction(page);
  if (page === 'reservations' && roleIs('Storage Customer')) renderStoragePageCatalog();
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.' }
function subtitleByRole() { if (roleIs('Storage Customer')) return 'Đặt kho, thanh toán và theo dõi hợp đồng của bạn.'; if (roleIs('Facility Staff')) return 'Xử lý check-in, bàn giao, trả kho và hỗ trợ.'; if (roleIs('Facility Manager')) return 'Duyệt đơn, quản lý kho, hợp đồng và nhân viên tại cơ sở.'; if (roleIs('Business Operations Manager')) return 'Cấu hình chính sách, biểu phí và theo dõi toàn hệ thống.'; return 'Quản lý tài khoản, vai trò, quyền truy cập và nhật ký hệ thống.' }
function primaryActionFor(page) { return ({ reservations: 'Chọn kho', units: '+ Thêm kho', customers: '+ Khách hàng', contracts: '+ Tạo hợp đồng', staff: '+ Phân công', facilities: '+ Thêm cơ sở', policies: '+ Chính sách mới', fees: '+ Tạo biểu phí', support: '+ Tạo yêu cầu', payments: '+ Thanh toán' })[page] || 'Thao tác' }
function primaryAction(page) {
  if (page === 'reservations' && roleIs('Storage Customer')) { renderStoragePageCatalog(); $('pageStorageCatalog')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return showToast('Chọn kho trực tiếp từ danh sách bên dưới.') }
  if (page === 'payments' && roleIs('Storage Customer')) return openNextCustomerPayment();
  if (page === 'payments' && (roleIs('Facility Staff') || roleIs('Facility Manager'))) return openExtraChargeModal();
  if (page === 'check-in') return openHandoverModal();
  if (page === 'returns') return openReturnModal();
  if (page === 'units') return openUnitModal();
  if (page === 'facilities') return openFacilityModal();
  if (page === 'policies') return openPolicyModal();
  if (page === 'fees') return openFeeModal();
  if (page === 'reports' && roleIs('Business Operations Manager')) return exportReport();
  if (page === 'support') return openSupportModal();
  if (page === 'staff') return openAssignStaffModal();
  showToast('Chọn một bản ghi để thực hiện thao tác.');
}

function stat(label, value, note, kind = '') { return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">◈</span></div><div class="stat-value">${value}</div><div class="stat-note ${kind}">${note}</div></div>` }
function panel(title, body) { return `<section class="panel"><div class="panel-head"><h3>${title}</h3></div>${body}</section>` }

function badge(s) { let c = 'reserved'; if (['Active', 'Paid', 'Approved', 'Available', 'Success', 'Completed', 'Rented', 'Resolved'].includes(s)) c = 'available'; if (['Maintenance', 'Damage Review', 'Pending Approval', 'Pending Payment', 'Pending Verification', 'Overdue', 'Return Requested'].includes(s)) c = 'reserved'; return `<span class="badge ${c}">${esc(s)}</span>` }

function dashboardByRole() { if (roleIs('Storage Customer')) return customerDashboard(); if (roleIs('Facility Staff')) return staffDashboard(); if (roleIs('Facility Manager')) return managerDashboard(); if (roleIs('Business Operations Manager')) return operationsDashboard(); return adminDashboard() }
function customerDashboard() { const bs = state.bookings.filter(x => x.customer === currentUser.email), cs = state.contracts.filter(x => x.customer === currentUser.email); return `<div class="stats">${stat('Kho đang thuê', cs.filter(x => x.status === 'Active').length, 'Active', 'up')}${stat('Đặt kho', bs.length, 'Có liên kết duyệt đơn', '')}${stat('Thanh toán', state.payments.filter(x => x.customer === currentUser.email).length, 'Đã ghi nhận', 'up')}${stat('Hỗ trợ', state.support.filter(x => x.customer === currentUser.email && x.status !== 'Resolved').length, 'Đang xử lý', 'warn')}</div><div class="grid-2">${panel('Đơn & hợp đồng của tôi', customerTable())}${panel('Hoạt động gần đây', activityHTML())}</div>` }
function customerTable() { const rows = state.bookings.filter(x => x.customer === currentUser.email); if (!rows.length) return `<div class="empty-state">Chưa có reservation. Vào <b>Đặt kho</b> để bắt đầu.</div>`; return `<table class="table"><thead><tr><th>Unit</th><th>Thời gian</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(b => `<tr><td><strong>${b.unitId}</strong></td><td>${b.start} → ${b.end}</td><td>${badge(b.status)}</td><td>${b.status === 'Pending Deposit' ? `<button class="mini-btn" onclick="openDepositPayment('${b.id}')">Đặt cọc</button>` : ''}${b.status === 'Approved' && !b.rentPaymentPaid ? `<button class="mini-btn" onclick="openPaymentModal('${b.id}')">Thanh toán tiền thuê</button>` : ''}${b.status === 'Paid' ? `<span class="muted">✓ Đã thanh toán · chờ Staff bàn giao</span>` : ''}${b.status === 'Handed Over' ? `<span class="muted">✓ Đã bàn giao</span>` : ''}${b.status === 'Pending Approval' ? `<span class="muted">Chờ Facility Manager duyệt</span>` : ''}</td></tr>`).join('')}</tbody></table>` }
function staffDashboard() { ensureStaffNotifications(); const pending = state.bookings.filter(x => x.status === 'Paid' && hasFacilityAccess(x.facility) && !state.handovers.some(h => h.bookingId === x.id)); const ret = state.contracts.filter(x => x.status === 'Return Requested'); const notes = visibleNotifications().filter(n => !n.read); return `<div class="stats">${stat('Chờ bàn giao', pending.length, 'Đã thanh toán', 'up')}${stat('Chờ trả kho', ret.length, 'Cần kiểm tra', 'warn')}${stat('Hỗ trợ', state.support.filter(x => x.status !== 'Resolved').length, 'Đang xử lý', 'warn')}${stat('Bàn giao', state.handovers.length, 'Đã hoàn tất', 'up')}</div><div class="grid-2"><div>${panel(`Thông báo bàn giao${notes.length ? ` · ${notes.length}` : ''}`, staffNotificationsHTML())}${panel('Lịch bàn giao', staffTaskTable())}</div>${panel('Hoạt động', activityHTML())}</div>` }
function staffNotificationsHTML() { const notes = visibleNotifications(); if (!notes.length) return `<div class="empty-state">Chưa có thông báo bàn giao.</div>`; return notes.slice(0, 8).map(n => `<div class="notification-row ${n.read ? 'read' : ''}"><span class="notification-dot"></span><div><strong>${esc(n.text)}</strong><p>${esc(n.time)} ${n.read ? '· Đã xử lý' : ''}</p></div></div>`).join('') }
function staffTaskTable() { const rows = state.bookings.filter(x => x.status === 'Paid' && hasFacilityAccess(x.facility) && !state.handovers.some(h => h.bookingId === x.id)); if (!rows.length) return `<div class="empty-state">Chưa có đơn đã thanh toán chờ bàn giao.</div>`; return `<table class="table"><thead><tr><th>Booking</th><th>Customer</th><th>Unit</th><th></th></tr></thead><tbody>${rows.map(b => `<tr><td>${b.id}</td><td>${esc(b.customer)}</td><td>${b.unitId}</td><td><button class="mini-btn" onclick="openHandoverModal('${b.id}')">Xác minh & bàn giao</button></td></tr>`).join('')}</tbody></table>` }
function managerDashboard() { const scoped = facilityScopedUnits(), pending = facilityScopedBookings().filter(x => x.status === 'Pending Approval'); const damaged = state.contracts.filter(x => x.status === 'Damage Review' && hasFacilityAccess(getUnit(x.unitId)?.facility)); return `<div class="stats">${stat('Chờ duyệt đơn', pending.length, 'Customer reservations', 'warn')}${stat('Kho', scoped.length, `${scoped.filter(x => x.status === 'Available').length} Available`, 'up')}${stat('Hợp đồng', state.contracts.filter(x => x.status === 'Active' && hasFacilityAccess(getUnit(x.unitId)?.facility)).length, 'Active', 'up')}${stat('Hư hại', damaged.length, 'Cần quyết định', 'warn')}</div><div class="grid-2">${panel('Đơn cần Facility Manager duyệt', managerApprovalTable())}${panel('Hoạt động', activityHTML())}</div>` }
function managerApprovalTable() { const rows = facilityScopedBookings().filter(x => x.status === 'Pending Approval'); if (!rows.length) return `<div class="empty-state">Không có đơn chờ duyệt.</div>`; return `<table class="table"><thead><tr><th>Booking</th><th>Customer</th><th>Unit</th><th>Period</th><th></th></tr></thead><tbody>${rows.map(b => `<tr><td>${b.id}</td><td>${esc(b.customer)}</td><td>${b.unitId}</td><td>${b.start} → ${b.end}</td><td><button class="mini-btn" onclick="openAssignUnitModal('${b.id}')">Phân kho</button> <button class="mini-btn" onclick="approveBooking('${b.id}')">Duyệt đơn</button> <button class="mini-btn" onclick="rejectBooking('${b.id}')">Từ chối</button></td></tr>`).join('')}</tbody></table>` }
function revenuePayments() { return state.payments.filter(p => p.status === 'Success' && ['rent', 'cycle', 'renewal', 'repair'].includes(p.kind)) }
function totalRevenue() { return revenuePayments().reduce((s, p) => s + Number(p.amount || 0), 0) }
function totalDepositsHeld() { return state.payments.filter(p => p.status === 'Success' && p.kind === 'deposit' && state.contracts.some(c => c.bookingId === p.bookingId && ['Active', 'Return Requested', 'Damage Review'].includes(c.status))).reduce((s, p) => s + Number(p.amount || 0), 0) }
function operationsDashboard() { const revenue = totalRevenue(); return `<div class="stats">${stat('Cơ sở', state.facilities.length, 'Active system-wide', 'up')}${stat('Kho', state.units.length, `${state.units.filter(x => x.status === 'Rented').length} đang thuê`, 'up')}${stat('Doanh thu', money(revenue), 'Không tính tiền cọc', 'up')}${stat('Tiền cọc đang giữ', money(totalDepositsHeld()), 'Deposit held', '')}${stat('Policies', '06', 'Configured', '')}</div><div class="grid-2">${panel('System snapshot', operationsTable())}${panel('Activity', activityHTML())}</div>` }
function operationsTable() { return `<table class="table"><thead><tr><th>Facility</th><th>Units</th><th>Available</th><th>Rented</th></tr></thead><tbody>${state.facilities.map(f => { const us = state.units.filter(u => u.facility === f.id); return `<tr><td><strong>${esc(f.name)}</strong></td><td>${us.length}</td><td>${us.filter(u => u.status === 'Available').length}</td><td>${us.filter(u => u.status === 'Rented').length}</td></tr>` }).join('')}</tbody></table>` }
function adminDashboard() { return `<div class="stats">${stat('Users', '1,842', 'Demo accounts + system', 'up')}${stat('Roles', '05', 'Configured', 'up')}${stat('Access events', state.activities.length, 'Current session', '')}${stat('Security', 'OK', 'Prototype', 'up')}</div><div class="grid-2">${panel('Role distribution', ['Storage Customer', 'Facility Staff', 'Facility Manager', 'Business Operations Manager', 'System Administrator'].map((r, i) => `<div class="role-card"><span class="role-tag">${[1702, 68, 18, 5, 2][i]}</span><h3>${r}</h3><p>Active accounts</p></div>`).join(''))}${panel('Recent activity', activityHTML())}</div>` }

/* ---------------- Flow 1: Reservation ---------------- */
function openBookingModal(preselectId) {
  if (!currentUser) { pendingAuthAction = { type: 'book', unitId: preselectId }; return openLoginModal('Bạn cần đăng nhập hoặc đăng ký tài khoản để đặt kho.'); }
  if (!roleIs('Storage Customer')) return showToast('Chỉ Storage Customer tạo reservation.');
  if (!preselectId) { renderPage('reservations'); $('pageStorageCatalog')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const u = getUnit(preselectId); if (!u || ['Maintenance', 'Rented'].includes(u.status)) return showToast('Kho này vừa không còn khả dụng.');
  const { min, max } = bookingStartWindow();
  openModal('Đặt kho · ' + u.id, `<div class="stepper"><b class="active">1. Chọn thời gian</b><b>2. Cách thanh toán</b><b>3. Đặt cọc</b><b>4. Manager duyệt</b></div><div class="selection-box"><strong>${esc(u.id)} · ${esc(climateOf(u))}</strong><p>${esc(getFacility(u.facility)?.name || u.facility)} · ${esc(u.size)} · <b>${money(u.price)}/tháng</b></p></div><div class="form-grid"><div><label>Ngày bắt đầu thuê / ngày nhận kho</label><input id="bookStart" type="date" min="${min}" max="${max}" value="${min}"><small class="field-hint">Ngày nhận kho phải từ hôm nay đến tối đa 1 tháng kể từ ngày đặt kho.</small></div><div><label>Giờ nhận kho</label><select id="bookTime"><option value="09:00">09:00</option><option value="10:30">10:30</option><option value="14:00">14:00</option><option value="15:30">15:30</option></select></div><div><label>Số tháng muốn thuê</label><select id="bookMonths"><option value="1">1 tháng</option><option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option><option value="24">24 tháng</option></select></div></div><div class="notice"><b>Ngày bắt đầu thuê là ngày dự kiến nhận kho.</b> Bạn chỉ được chọn trong khoảng ${min} → ${max}. Hệ thống sẽ kiểm tra kho còn trống cho toàn bộ kỳ thuê.</div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="showPaymentPlanStep('${u.id}')">Tiếp tục →</button></div>`);
}
function showPaymentPlanStep(unitId) {
  refreshDemoState();
  const u = getUnit(unitId), start = $('bookStart').value, appointmentTime = $('bookTime').value, months = Number($('bookMonths').value); if (!start) return showToast('Vui lòng chọn ngày bắt đầu thuê / ngày nhận kho.'); if (!isValidBookingStart(start)) return showToast('Ngày nhận kho phải từ hôm nay đến tối đa 1 tháng kể từ ngày đặt kho.'); if (!months) return showToast('Vui lòng chọn số tháng thuê.');
  const endDate = new Date(start); endDate.setMonth(endDate.getMonth() + months); endDate.setDate(endDate.getDate() - 1); const end = endDate.toISOString().slice(0, 10); if (!isUnitAvailableForPeriod(u, start, end)) return showToast('Kho này không còn trống trong toàn bộ kỳ thuê đã chọn. Vui lòng chọn kho hoặc thời gian khác.'); const grossRent = u.price * months, discount = Math.min(100, Math.max(0, Number(state.fees.discountPercent) || 0)), rent = Math.round(grossRent * (1 - discount / 100)), deposit = u.price * state.policies.depositMonths, monthly = Math.round(rent / months);
  openModal('Đặt kho · Cách thanh toán', `<div class="stepper"><b class="active">1. Thời gian ✓</b><b class="active">2. Cách thanh toán</b><b>3. Đặt cọc</b><b>4. Manager duyệt</b></div><div class="selection-box"><strong>${esc(u.id)}</strong><p>Ngày nhận kho: <b>${start}</b> · Giờ: <b>${appointmentTime}</b> · Kỳ thuê: ${start} → ${end} · ${months} tháng · ${money(u.price)}/tháng</p></div><label>Cách thanh toán tiền thuê</label><select id="bookPaymentPlan"><option value="Full">Trả hết 1 lần</option><option value="Periodic">Trả theo chu kỳ</option></select><div class="confirmation-box"><div><strong id="planTitle">Trả hết 1 lần</strong><p>Tiền thuê gốc: ${money(grossRent)}</p>${discount > 0 ? `<p>Giảm giá: <b>${discount}%</b> · Tiết kiệm ${money(grossRent - rent)}</p>` : ''}<p>Tổng tiền thuê sau chính sách: ${money(rent)}</p><p id="planLine">Thanh toán tiền thuê sau khi Manager duyệt: ${money(rent)}</p><p>Tiền cọc ngay: <b>${money(deposit)}</b> (${state.policies.depositMonths} tháng)</p></div></div><div class="notice">Tiền cọc phải được thanh toán trước khi reservation chuyển sang Facility Manager.</div><div class="modal-actions"><button class="secondary-btn" onclick="openBookingModal('${u.id}')">← Quay lại</button><button class="primary-btn" onclick="confirmBooking('${u.id}','${u.facility}','${u.type}','${start}','${end}','${appointmentTime}',${rent},${deposit},${months},${monthly})">Tiếp tục đặt cọc →</button></div>`);
  $('bookPaymentPlan').onchange = () => { const periodic = $('bookPaymentPlan').value === 'Periodic'; $('planTitle').textContent = periodic ? 'Trả theo chu kỳ' : 'Trả hết 1 lần'; $('planLine').textContent = periodic ? `Kỳ đầu sau duyệt: ${money(monthly)}/tháng` : `Thanh toán tiền thuê sau khi Manager duyệt: ${money(rent)}` };
}
function confirmBooking(unitId, facility, type, start, end, appointmentTime, rent, deposit, months, monthly) {
  refreshDemoState();
  const u = getUnit(unitId), plan = $('bookPaymentPlan').value; if (!u || ['Maintenance', 'Rented'].includes(u.status) || unitHasOverlap(unitId, start, end)) return showToast('Kho vừa được giữ bởi giao dịch khác hoặc không còn trống trong kỳ thuê.');
  openModal('Xác nhận đặt cọc', `<div class="summary-list"><div><span>Kho</span><b>${esc(u.id)}</b></div><div><span>Thời gian</span><b>${start} → ${end}</b></div><div><span>Lịch nhận kho</span><b>${start} · ${appointmentTime}</b></div><div><span>Số tháng</span><b>${months} tháng</b></div><div><span>Thanh toán tiền thuê</span><b>${plan === 'Periodic' ? 'Theo chu kỳ' : 'Trả hết 1 lần'}</b></div><div><span>Tổng tiền thuê</span><b>${money(rent)}</b></div><div><span>Tiền cọc</span><b>${money(deposit)}</b></div></div><div class="notice">Sau khi cọc thành công, reservation chuyển <b>Pending Approval</b>. Manager mới có quyền duyệt.</div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createBooking('${u.id}','${facility}','${type}','${start}','${end}','${appointmentTime}',${rent},${deposit},${months},'${plan}',${monthly})">Đặt cọc ${money(deposit)} →</button></div>`);
}
function createBooking(unitId, facility, type, start, end, appointmentTime, rent, deposit, months, plan, monthly) {
  refreshDemoState();
  const u = getUnit(unitId); if (!isValidBookingStart(start)) return showToast('Ngày nhận kho phải từ hôm nay đến tối đa 1 tháng kể từ ngày đặt kho.'); if (!u || ['Maintenance', 'Rented'].includes(u.status) || unitHasOverlap(unitId, start, end)) return showToast('Kho vừa được giữ bởi giao dịch khác hoặc không còn trống trong kỳ thuê.');
  const grossRent = Number(u.price || 0) * Number(months || 0); const b = { id: nextId('BK', state.bookings), customer: currentUser.email, unitId, facility, type, start, end, rent, deposit, months, paymentPlan: plan, status: 'Pending Deposit', createdBy: currentUser.email, monthlyRent: monthly, grossRent, discountAmount: grossRent - rent, discountPercent: Number(state.fees.discountPercent) || 0, depositPaid: false, appointmentDate: start, appointmentTime: appointmentTime || '09:00', bookingWindowMax: bookingStartWindow().max };
  state.bookings.push(b); u.status = 'Reserved'; addActivity(`Customer tạo ${b.id} · ${unitId} · chờ thanh toán cọc`, { customer: b.customer, facilityId: b.facility, bookingId: b.id, category: 'reservation' }); closeModal(); openDepositPayment(b.id);
}
function openDepositPayment(id) {
  if (!roleIs('Storage Customer')) return; const b = getBooking(id); if (!b || b.status !== 'Pending Deposit') return;
  const code = `SS-${b.id}-DEP`.toUpperCase(); b.depositPaymentCode = code;
  openModal('Thanh toán tiền cọc · QR', `<div class="payment-card"><div><span>Reservation</span><strong>${b.id}</strong></div><div><span>Storage</span><strong>${b.unitId}</strong></div><div><span>Tiền cọc</span><strong>${money(b.deposit)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN DUY NHẤT</span><h3>${esc(code)}</h3><p>QR demo. Mã này chỉ dùng một lần cho tiền cọc của reservation.</p></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Để sau</button><button class="primary-btn" onclick="completeDeposit('${b.id}','${code}')">Xác nhận đã thanh toán · ${money(b.deposit)}</button></div>`);
}
function completeDeposit(id, code) {
  refreshDemoState();
  const b = getBooking(id); if (!b) return showToast('Reservation không tồn tại.');
  const existing = state.payments.find(p => p.bookingId === id && p.kind === 'deposit' && p.status === 'Success');
  if (existing || b.depositPaid) return showToast(`Tiền cọc ${id} đã được thanh toán bằng mã ${existing?.paymentCode || b.depositPaymentCode}.`);
  if (b.status !== 'Pending Deposit') return showToast('Reservation không còn chờ cọc.');
  if (code !== `SS-${id}-DEP`.toUpperCase()) return showToast('Mã thanh toán cọc không hợp lệ.');
  state.payments.push({ id: nextId('PAY', state.payments), bookingId: id, customer: b.customer, amount: b.deposit, status: 'Success', kind: 'deposit', paymentCode: code, method: 'QR Payment' }); b.depositPaid = true; b.status = 'Pending Approval'; b.depositPaidAt = nowISO();
  addActivity(`Customer đặt cọc ${b.id} · ${money(b.deposit)} · chuyển Facility Manager duyệt`, { customer: b.customer, facilityId: b.facility, bookingId: b.id, financial: true, category: 'payment' }); addNotification('Facility Manager', `Reservation ${b.id} đã thanh toán cọc và đang chờ bạn duyệt.`, b.id, 'approval'); closeModal(); renderPage('reservations'); showToast('Đặt cọc thành công. Manager đã nhận case cần duyệt.');
}
function openAssignUnitModal(id) { if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager phân kho.'); const b = getBooking(id); if (!b || b.status !== 'Pending Approval') return showToast('Reservation phải đã đóng cọc và chờ duyệt.'); if (!hasFacilityAccess(b.facility)) return showToast('Bạn không có quyền tại cơ sở này.'); const original = getUnit(b.unitId); const candidates = state.units.filter(u => u.facility === b.facility && climateOf(u) === b.type && u.size === original?.size && u.price === original?.price && (isUnitAvailableForPeriod(u, b.start, b.end, b.unitId) || u.id === b.unitId)); const options = (candidates.length ? candidates : state.units.filter(u => u.facility === b.facility && isUnitAvailableForPeriod(u, b.start, b.end, b.unitId))).map(u => `<option value="${esc(u.id)}" ${u.id === b.unitId ? 'selected' : ''}>${esc(u.id)} · ${esc(u.location || 'Chưa có vị trí')} · ${esc(u.size)} · ${money(u.price)}</option>`).join(''); openModal('Phân kho cho reservation', `<div class="summary-list"><div><span>Booking</span><b>${b.id}</b></div><div><span>Customer</span><b>${esc(b.customer)}</b></div><div><span>Kỳ thuê</span><b>${b.start} → ${b.end}</b></div></div><label>Kho phù hợp</label><select id="assignUnitSelect">${options || '<option value="">Không có kho phù hợp</option>'}</select><div class="notice">Manager có thể giữ kho hiện tại hoặc đổi sang kho cùng cơ sở còn trống cho toàn bộ kỳ thuê.</div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="assignUnitToBooking('${b.id}')">Xác nhận phân kho</button></div>`) }
function assignUnitToBooking(id) { if (!roleIs('Facility Manager')) return; const b = getBooking(id), newId = $('assignUnitSelect').value; if (!b || b.status !== 'Pending Approval' || !newId) return; const old = getUnit(b.unitId), nu = getUnit(newId); if (!nu || !isUnitAvailableForPeriod(nu, b.start, b.end, b.unitId)) return showToast('Kho được chọn không còn khả dụng trong toàn bộ kỳ thuê.'); if (old && old.id !== nu.id && old.status === 'Reserved' && !state.bookings.some(x => x.id !== b.id && x.unitId === old.id && ['Pending Deposit', 'Pending Verification', 'Pending Approval', 'Approved', 'Paid', 'Handed Over'].includes(x.status))) old.status = 'Available'; nu.status = 'Reserved'; b.unitId = nu.id; b.assignedUnitBy = currentUser.email; b.assignedUnitAt = nowISO(); addActivity(`Facility Manager phân kho ${nu.id} cho ${b.id}`); addNotification('Storage Customer', `Reservation ${b.id} đã được phân kho ${nu.id}.`, b.id, 'unit-assigned'); closeModal(); renderPage('dashboard'); showToast(`Đã phân kho ${nu.id}.`); }
function approveBooking(id) { if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager duyệt reservation.'); refreshDemoState(); const b = getBooking(id); if (!b || b.status !== 'Pending Approval') return showToast('Đơn phải được đặt cọc thành công trước khi duyệt.'); if (!hasFacilityAccess(b.facility)) return showToast('Bạn không có quyền duyệt reservation tại cơ sở này.'); b.status = 'Approved'; b.approvedBy = currentUser.email; b.approvedAt = nowISO(); addActivity(`Facility Manager duyệt ${b.id} · ${b.unitId}`); addNotification('Storage Customer', `Reservation ${b.id} đã được duyệt. Bạn có thể thanh toán tiền thuê.`, b.id, 'payment'); renderPage(currentPage); showToast('Đã duyệt. Customer có thể thanh toán tiền thuê.'); }
function rejectBooking(id) { if (!roleIs('Facility Manager')) return; const b = getBooking(id); if (!b || !hasFacilityAccess(b.facility)) return showToast('Bạn không có quyền xử lý reservation tại cơ sở này.'); b.status = 'Rejected'; const u = getUnit(b.unitId); if (u && u.status === 'Reserved') u.status = 'Available'; addActivity(`Reservation ${b.id} bị từ chối · cọc chuyển sang xử lý hoàn theo policy`); addNotification('Storage Customer', `Reservation ${b.id} bị từ chối. Tiền cọc chuyển sang xử lý hoàn theo policy.`, b.id, 'rejected'); renderPage(currentPage); showToast('Đã từ chối reservation.'); }

/* ---------------- Flow 2: QR payment + check-in / handover ---------------- */
function openPaymentModal(bookingId) {
  if (!roleIs('Storage Customer')) return showToast('Customer thực hiện thanh toán.');
  refreshDemoState();
  const b = getBooking(bookingId) || state.bookings.find(x => x.customer === currentUser.email && x.status === 'Approved');
  if (!b) return showToast('Chưa có booking được Manager duyệt.');
  if (b.rentPaymentStatus === 'Pending Verification') return showToast(`Payment ${b.id} đang chờ hệ thống xác minh. Không được tạo giao dịch mới.`);
  if (b.rentPaymentPaid || state.payments.some(p => p.bookingId === b.id && p.kind === 'rent' && p.status === 'Success')) return showToast(`Booking ${b.id} đã thanh toán tiền thuê. Chỉ một lần bằng mã ${paymentCodeFor(b)}.`);
  const amount = b.paymentPlan === 'Periodic' ? b.monthlyRent : b.rent, code = paymentCodeFor(b); b.rentPaymentCode = code;
  openModal('Thanh toán tiền thuê · QR Payment', `<div class="payment-card"><div><span>Reservation</span><strong>${b.id}</strong></div><div><span>Storage</span><strong>${b.unitId}</strong></div><div><span>Số tiền kỳ này</span><strong>${money(amount)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN DUY NHẤT</span><h3>${esc(code)}</h3><p>Quét QR để mô phỏng thanh toán. Mã này chỉ có hiệu lực <b>một lần</b> cho khoản thanh toán tiền thuê ban đầu của booking.</p><div class="summary-list"><div><span>Kế hoạch</span><b>${b.paymentPlan === 'Periodic' ? 'Theo chu kỳ · kỳ đầu' : 'Trả hết 1 lần'}</b></div><div><span>Trạng thái</span><b>Chờ thanh toán</b></div></div></div></div><div class="notice"><b>Không có nút thanh toán lại</b> sau khi giao dịch thành công. Với chu kỳ, kỳ sau sẽ có mã mới.</div><div class="modal-actions"><button class="secondary-btn" onclick="simulatePaymentInterruption('${b.id}','rent','${code}',${amount})">Mô phỏng mất kết nối</button><button class="primary-btn" onclick="completeRentPayment('${b.id}',${amount},'${code}')">Xác nhận đã thanh toán · ${money(amount)}</button></div>`);
}
function completeRentPayment(id, amount, code) {
  refreshDemoState();
  const b = getBooking(id); if (!b) return showToast('Booking không tồn tại.');
  const success = state.payments.find(p => p.bookingId === id && p.kind === 'rent' && p.status === 'Success');
  if (success || b.rentPaymentPaid) return showToast(`Booking ${id} chỉ được thanh toán một lần bằng mã ${success?.paymentCode || paymentCodeFor(b)}.`);
  if (b.status !== 'Approved') return showToast('Booking chưa được duyệt hoặc đang chờ xác minh thanh toán.');
  if (code !== paymentCodeFor(b)) return showToast('Mã thanh toán không hợp lệ.');
  const pay = Number(amount) || 0; if (pay <= 0) return showToast('Số tiền không hợp lệ.');
  const pending = state.payments.find(p => p.bookingId === id && p.kind === 'rent' && p.status === 'Pending Verification');
  if (pending) return verifyRentPayment(id, code);
  state.payments.push({ id: nextId('PAY', state.payments), bookingId: id, customer: b.customer, amount: pay, status: 'Success', kind: 'rent', plan: b.paymentPlan, method: 'QR Payment', paymentCode: code, period: b.paymentPlan === 'Periodic' ? 'Initial Cycle' : 'Full', transactionRef: `TX-${id}-001` });
  markRentPaidAndNotify(b, pay, code);
}
function markRentPaidAndNotify(b, pay, code) {
  b.rentPaidAmount = pay; b.rentPaymentPaid = true; b.rentPaymentCode = code; b.rentPaymentStatus = 'Paid'; b.handoverReady = true; b.firstRentPaymentAt = nowISO(); b.status = 'Paid';
  if (b.paymentPlan === 'Periodic') { b.remainingRent = Math.max(0, b.rent - pay); b.nextPaymentDue = 'Kỳ tiếp theo'; }
  addActivity(`Customer thanh toán tiền thuê ${b.id} · ${money(pay)} · ${b.paymentPlan === 'Periodic' ? 'kỳ đầu' : 'một lần'} · ${code}`, { customer: b.customer, facilityId: b.facility, bookingId: b.id, financial: true, category: 'payment' });
  addNotification('Facility Staff', `Booking ${b.id} · ${b.unitId} đã thanh toán tiền thuê, sẵn sàng check-in & bàn giao.`, b.id, 'handover');
  closeModal(); renderPage('dashboard'); showToast('Thanh toán thành công. Staff đã nhận thông báo bàn giao.');
}
function simulatePaymentInterruption(id, kind, code, amount) {
  refreshDemoState();
  if (kind !== 'rent') return;
  const b = getBooking(id); if (!b || b.status !== 'Approved') return showToast('Booking không còn ở trạng thái thanh toán.');
  if (state.payments.some(p => p.bookingId === id && p.kind === 'rent' && ['Success', 'Pending Verification'].includes(p.status))) return showToast('Đã có giao dịch cho booking này. Không tạo giao dịch mới.');
  state.payments.push({ id: nextId('PAY', state.payments), bookingId: id, customer: b.customer, amount: Number(amount) || 0, status: 'Pending Verification', kind: 'rent', plan: b.paymentPlan, method: 'QR Payment', paymentCode: code, period: b.paymentPlan === 'Periodic' ? 'Initial Cycle' : 'Full', transactionRef: `TX-${id}-001` });
  b.rentPaymentStatus = 'Pending Verification'; saveState(); closeModal(); renderPage('payments'); showToast('Đã mô phỏng mất kết nối. Hệ thống giữ giao dịch để xác minh, chưa cho bàn giao.');
}
function verifyRentPayment(id, code) {
  refreshDemoState();
  const b = getBooking(id), p = state.payments.find(x => x.bookingId === id && x.kind === 'rent'); if (!b || !p) return showToast('Không tìm thấy giao dịch.');
  if (p.status === 'Success') return showToast(`Giao dịch ${p.paymentCode} đã được ghi nhận trước đó. Không ghi nhận lần 2.`);
  if (p.status !== 'Pending Verification') return showToast('Giao dịch không ở trạng thái chờ xác minh.');
  if (code !== p.paymentCode) return showToast('Mã giao dịch không hợp lệ.');
  p.status = 'Success'; p.verifiedAt = nowISO(); markRentPaidAndNotify(b, p.amount, p.paymentCode);
}

function openHandoverModal(id) {
  if (!roleIs('Facility Staff')) return showToast('Facility Staff thực hiện check-in & bàn giao.');
  ensureStaffNotifications(); refreshDemoState();
  const b = getBooking(id) || state.bookings.find(x => x.status === 'Paid' && !state.handovers.some(h => h.bookingId === x.id)); if (!b) return showToast('Chưa có booking đã thanh toán chờ bàn giao.');
  const appointmentDate = b.appointmentDate || b.start, appointmentTime = b.appointmentTime || '09:00';
  if (!hasFacilityAccess(b.facility)) return showToast('Staff không được phân quyền tại cơ sở của booking này.');
  openModal('Check-in & Bàn giao', `<div class="verification-box"><div class="verification-icon">✓</div><div><strong>Payment Verified</strong><p>${b.id} · ${esc(b.customer)}</p></div></div><div class="summary-list"><div><span>Customer</span><b>${esc(b.customer)}</b></div><div><span>Facility</span><b>${esc(getFacility(b.facility)?.name || b.facility)}</b></div><div><span>Unit</span><b>${b.unitId}</b></div><div><span>Period</span><b>${b.start} → ${b.end}</b></div><div><span>Lịch check-in</span><b>${appointmentDate} · ${appointmentTime}</b></div><div><span>Payment code</span><b>${esc(paymentCodeFor(b))}</b></div></div><div class="notice"><b>Checklist bắt buộc trước bàn giao</b><div style="display:grid;gap:7px;margin-top:10px"><label><input type="checkbox" id="verifyCustomer"> Đúng Customer</label><label><input type="checkbox" id="verifyBooking"> Đúng Booking</label><label><input type="checkbox" id="verifyFacility"> Đúng Facility + Unit</label><label><input type="checkbox" id="verifyPayment"> Payment = Success</label><label><input type="checkbox" id="verifyAppointment"> Đúng lịch check-in</label></div></div><label>Hình thức bàn giao</label><select id="accessMethod"><option>Access Card</option><option>Door Code</option><option>Key + Access Card</option></select><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeHandover('${b.id}')">Xác nhận bàn giao</button></div>`);
}
function completeHandover(id) {
  if (!roleIs('Facility Staff')) return;
  refreshDemoState(); const b = getBooking(id); if (!b) return showToast('Booking không tồn tại.');
  if (!hasFacilityAccess(b.facility)) return showToast('Staff không được phân quyền tại cơ sở này.');
  if (state.handovers.some(x => x.bookingId === id) || b.status === 'Handed Over') return showToast(`Booking ${id} đã bàn giao. Không thể bàn giao lần 2.`);
  const payment = state.payments.find(p => p.bookingId === id && p.kind === 'rent');
  const today = new Date().toISOString().slice(0, 10), appointmentDate = b.appointmentDate || b.start, appointmentTime = b.appointmentTime || '09:00';
  if (b.status !== 'Paid' || !b.rentPaymentPaid || !payment || payment.status !== 'Success') return showToast('Không thể bàn giao: payment chưa được xác nhận thành công.');
  if (!b.customer || !b.facility || !b.unitId) return showToast('Thiếu thông tin Customer / Facility / Unit.');
  if (appointmentDate !== today) return showToast(`Chưa đến lịch check-in. Lịch của booking là ${appointmentDate} · ${appointmentTime}.`);
  if (!['verifyCustomer', 'verifyBooking', 'verifyFacility', 'verifyPayment', 'verifyAppointment'].every(id => $(id)?.checked)) return showToast('Vui lòng xác nhận đầy đủ checklist trước khi bàn giao.');
  const u = getUnit(b.unitId); if (!u || u.status !== 'Reserved') return showToast('Unit không còn ở trạng thái Reserved.');
  u.status = 'Rented'; b.status = 'Handed Over';
  const c = { id: nextId('CT', state.contracts), bookingId: id, customer: b.customer, unitId: b.unitId, type: b.type, start: b.start, end: b.end, status: 'Active', paymentPlan: b.paymentPlan, deposit: b.deposit, rent: b.rent }; state.contracts.push(c);
  state.handovers.push({ id: nextId('HO', state.handovers), bookingId: id, staff: currentUser.email, access: $('accessMethod').value, time: nowISO(), verified: { customer: $('verifyCustomer').checked, booking: $('verifyBooking').checked, facility: $('verifyFacility').checked, payment: $('verifyPayment').checked, appointment: $('verifyAppointment').checked } });
  if (b.paymentPlan === 'Periodic') { const s = { id: nextId('SCH', state.paymentSchedules), contractId: c.id, customer: c.customer, amount: b.monthlyRent, dueLabel: 'Kỳ tiếp theo', status: 'Pending', cycle: 2 }; s.paymentCode = scheduleCodeFor(s); state.paymentSchedules.push(s) }
  state.notifications = (state.notifications || []).map(n => n.role === 'Facility Staff' && n.bookingId === b.id && n.kind === 'handover' ? { ...n, read: true } : n);
  addActivity(`Staff bàn giao ${b.unitId} cho ${b.customer} · ${b.id}`, { customer: b.customer, facilityId: b.facility, bookingId: b.id, category: 'handover' }); addNotification('Storage Customer', `Kho ${b.unitId} đã được bàn giao. Hợp đồng ${c.id} đang Active.`, b.id, 'handover-complete'); closeModal(); renderPage('check-in'); showToast('Bàn giao hoàn tất. Hợp đồng Active đã tạo.');
}


/* ---------------- Flow 3: Rented unit management / renewal / periodic payment ---------------- */
function renderMyUnits() {
  const cs = state.contracts.filter(x => x.customer === currentUser.email && ['Active', 'Return Requested', 'Damage Review', 'Completed'].includes(x.status));
  const pendingRenew = state.renewals.filter(r => r.status === 'Pending Payment' && cs.some(c => c.id === r.contractId));
  return `<div class="grid-2"><div class="panel"><div class="panel-head"><h3>Kho đang thuê</h3></div>${cs.length ? `<table class="table"><thead><tr><th>Unit</th><th>Period</th><th>Plan</th><th>Status</th><th>Action</th></tr></thead><tbody>${cs.map(c => { const sched = state.paymentSchedules.find(s => s.contractId === c.id && s.status === 'Pending'); return `<tr><td><strong>${c.unitId}</strong></td><td>${c.start} → ${c.end}</td><td>${c.paymentPlan === 'Periodic' ? 'Theo chu kỳ' : 'Một lần'}</td><td>${badge(c.status)}</td><td>${c.status === 'Active' ? `<button class="mini-btn" onclick="openRenewModal('${c.id}')">Gia hạn</button> <button class="mini-btn" onclick="requestReturn('${c.id}')">Yêu cầu trả kho</button>` : ''}${sched ? `<button class="mini-btn" onclick="openSchedulePayment('${sched.id}')">Thanh toán kỳ tiếp theo</button>` : ''}</td></tr>` }).join('')}</tbody></table>` : `<div class="empty-state">Chưa có kho đang thuê.</div>`}</div>${pendingRenew.length ? panel('Gia hạn đang chờ thanh toán', pendingRenew.map(r => `<div class="confirmation-box"><div><strong>${r.id}</strong><p>${r.months} tháng · ${money(r.amount)} · mã ${esc(renewalCodeFor(r))}</p></div><button class="mini-btn" onclick="openRenewalPayment('${r.id}')">Thanh toán</button></div>`).join('')) : panel('Quản lý hợp đồng', 'Bạn có thể xem thời hạn, gia hạn, thanh toán kỳ tiếp theo hoặc gửi yêu cầu trả kho.')}</div>`;
}
function openRenewModal(id) { if (!roleIs('Storage Customer')) return; const c = getContract(id); if (!c || c.status !== 'Active') return showToast('Hợp đồng không thể gia hạn.'); const u = getUnit(c.unitId); openModal('Gia hạn hợp đồng', `<div class="summary-list"><div><span>Contract</span><b>${c.id}</b></div><div><span>Unit</span><b>${c.unitId}</b></div><div><span>Ngày kết thúc hiện tại</span><b>${c.end}</b></div><div><span>Giá/tháng</span><b>${money(u.price)}</b></div></div><label>Thời gian gia hạn</label><select id="renewMonths"><option value="1">1 tháng</option><option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option></select><div class="notice">Phí gia hạn = số tháng × giá kho + renewal fee theo policy.</div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createRenewal('${c.id}')">Tạo khoản gia hạn</button></div>`) }
function createRenewal(id) {
  const c = getContract(id), u = getUnit(c.unitId), m = Number($('renewMonths').value); if (!c || c.status !== 'Active' || !m) return showToast('Không thể tạo renewal.');
  if (state.renewals.some(r => r.contractId === id && r.status === 'Pending Payment')) return showToast('Hợp đồng này đang có một khoản gia hạn chờ thanh toán.');
  const start = new Date(c.end); start.setDate(start.getDate() + 1); const end = new Date(start); end.setMonth(end.getMonth() + m); end.setDate(end.getDate() - 1); const amount = u.price * m + Number(state.policies.renewalFee || 0); const r = { id: nextId('REN', state.renewals), contractId: id, customer: c.customer, months: m, amount, proposedEnd: end.toISOString().slice(0, 10), status: 'Pending Payment', createdAt: nowISO() }; r.paymentCode = renewalCodeFor(r); state.renewals.push(r); c.pendingRenewal = { renewalId: r.id, end: r.proposedEnd, amount }; addActivity(`Customer tạo renewal ${r.id} · ${c.id} · ${m} tháng`); addNotification('Facility Manager', `Hợp đồng ${c.id} có yêu cầu gia hạn ${m} tháng, đang chờ Customer thanh toán.`, null, 'renewal', null, getUnit(c.unitId)?.facility); closeModal(); renderPage('my-units'); showToast(`Đã tạo phí gia hạn ${money(amount)}. Thanh toán để gia hạn có hiệu lực.`);
}
function openRenewalPayment(id) { if (!roleIs('Storage Customer')) return; const r = state.renewals.find(x => x.id === id && x.customer === currentUser.email); if (!r || r.status !== 'Pending Payment') return showToast('Khoản gia hạn không còn chờ thanh toán.'); const code = renewalCodeFor(r); openModal('Thanh toán gia hạn · QR', `<div class="payment-card"><div><span>Renewal</span><strong>${r.id}</strong></div><div><span>Số tiền</span><strong>${money(r.amount)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN GIA HẠN</span><h3>${esc(code)}</h3><p>Mã chỉ dùng một lần cho khoản gia hạn này.</p><p>Thời hạn mới đến <b>${r.proposedEnd}</b>.</p></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeRenewalPayment('${r.id}','${code}')">Xác nhận đã thanh toán · ${money(r.amount)}</button></div>`) }
function completeRenewalPayment(id, code) {
  const r = state.renewals.find(x => x.id === id && x.customer === currentUser.email); if (!r || r.status !== 'Pending Payment') return showToast('Renewal đã được thanh toán hoặc không tồn tại.'); if (state.payments.some(p => p.kind === 'renewal' && p.renewalId === id)) return showToast(`Renewal ${id} chỉ được thanh toán một lần.`); if (code !== renewalCodeFor(r)) return showToast('Mã renewal không hợp lệ.');
  const c = getContract(r.contractId); r.status = 'Paid'; r.paidAt = nowISO(); state.payments.push({ id: nextId('PAY', state.payments), customer: r.customer, amount: r.amount, status: 'Success', kind: 'renewal', renewalId: r.id, contractId: r.contractId, paymentCode: code, method: 'QR Payment' }); if (c) { c.end = r.proposedEnd; delete c.pendingRenewal; }
  addActivity(`Customer thanh toán renewal ${r.id} · ${money(r.amount)} · ${code}`, { customer: r.customer, facilityId: getUnit(getContract(r.contractId)?.unitId)?.facility, contractId: r.contractId, financial: true, category: 'payment' }); addNotification('Facility Manager', `Renewal ${r.id} của ${r.contractId} đã thanh toán và thời hạn hợp đồng đã cập nhật.`, null, 'renewal-paid', null, getUnit(getContract(r.contractId)?.unitId)?.facility); closeModal(); renderPage('my-units'); showToast('Gia hạn thành công. Thời hạn hợp đồng đã được cập nhật.');
}
function openSchedulePayment(id) { if (!roleIs('Storage Customer')) return; const s = state.paymentSchedules.find(x => x.id === id && x.customer === currentUser.email); if (!s || s.status !== 'Pending') return showToast('Kỳ thanh toán không còn chờ thanh toán.'); const code = scheduleCodeFor(s); openModal('Thanh toán kỳ tiếp theo · QR', `<div class="payment-card"><div><span>Contract</span><strong>${s.contractId}</strong></div><div><span>Kỳ</span><strong>${s.dueLabel}</strong></div><div><span>Số tiền</span><strong>${money(s.amount)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN KỲ</span><h3>${esc(code)}</h3><p>Mỗi kỳ có một mã riêng. Không thể dùng lại mã sau khi thanh toán.</p></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeSchedulePayment('${s.id}','${code}')">Xác nhận đã thanh toán · ${money(s.amount)}</button></div>`) }
function completeSchedulePayment(id, code) { const s = state.paymentSchedules.find(x => x.id === id && x.customer === currentUser.email); if (!s || s.status !== 'Pending') return showToast('Kỳ thanh toán đã hoàn tất.'); if (state.payments.some(p => p.kind === 'cycle' && p.scheduleId === id)) return showToast(`Kỳ ${id} chỉ được thanh toán một lần.`); if (code !== scheduleCodeFor(s)) return showToast('Mã kỳ thanh toán không hợp lệ.'); s.status = 'Paid'; s.paidAt = nowISO(); state.payments.push({ id: nextId('PAY', state.payments), customer: s.customer, amount: s.amount, status: 'Success', kind: 'cycle', scheduleId: s.id, contractId: s.contractId, paymentCode: code, method: 'QR Payment' }); const next = { id: nextId('SCH', state.paymentSchedules), contractId: s.contractId, customer: s.customer, amount: s.amount, dueLabel: `Kỳ ${Number(s.cycle || 2) + 1}`, status: 'Pending', cycle: Number(s.cycle || 2) + 1 }; next.paymentCode = scheduleCodeFor(next); state.paymentSchedules.push(next); addActivity(`Customer thanh toán ${s.dueLabel} · ${s.contractId} · ${money(s.amount)}`, { customer: s.customer, facilityId: getUnit(getContract(s.contractId)?.unitId)?.facility, contractId: s.contractId, financial: true, category: 'payment' }); closeModal(); renderPage('my-units'); showToast('Đã thanh toán kỳ này. Kỳ tiếp theo đã được tạo.'); }
function openNextCustomerPayment() { const b = state.bookings.find(x => x.customer === currentUser.email && x.status === 'Approved' && !x.rentPaymentPaid); if (b) return openPaymentModal(b.id); const s = state.paymentSchedules.find(x => x.customer === currentUser.email && x.status === 'Pending'); if (s) return openSchedulePayment(s.id); const r = state.renewals.find(x => x.customer === currentUser.email && x.status === 'Pending Payment'); if (r) return openRenewalPayment(r.id); showToast('Không có khoản thanh toán nào đang chờ.'); }
function requestReturn(contractId) { const c = getContract(contractId); if (!c || c.status !== 'Active') return; c.status = 'Return Requested'; addActivity(`Customer yêu cầu trả kho ${c.unitId} · ${c.id}`); addNotification('Facility Staff', `Customer yêu cầu trả kho ${c.unitId}. Staff cần kiểm tra tình trạng kho.`, null, 'return', null, getUnit(c.unitId)?.facility); renderPage('my-units'); showToast('Đã gửi yêu cầu trả kho cho Staff.'); }

/* ---------------- Flow 4: Return / damage / fee / revenue ---------------- */
function openReturnModal() {
  if (!roleIs('Facility Staff')) return showToast('Facility Staff thực hiện kiểm tra trả kho.');
  const c = state.contracts.find(x => x.status === 'Return Requested'); if (!c) return showToast('Chưa có yêu cầu trả kho.');
  openModal('Trả kho & kiểm tra', `<div class="verification-box"><div class="verification-icon">✓</div><div><strong>${c.unitId}</strong><p>${esc(c.customer)} · ${c.id}</p></div></div><label>Tình trạng kho</label><select id="returnCondition"><option value="good">Good — Không hư hại</option><option value="damage">Damaged — Có hư hại</option></select><label>Ghi chú</label><textarea id="returnNote" rows="3" placeholder="Mô tả tình trạng kho..."></textarea><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeReturn('${c.id}')">Xác nhận kiểm tra</button></div>`);
}
function completeReturn(id) { const c = getContract(id); if (!c || c.status !== 'Return Requested') return; const damaged = $('returnCondition').value === 'damage', u = getUnit(c.unitId); c.status = damaged ? 'Damage Review' : 'Completed'; u.status = damaged ? 'Maintenance' : 'Available'; state.returns.push({ id: nextId('RET', state.returns), contractId: id, condition: damaged ? 'Damaged' : 'Good', note: $('returnNote').value || '', staff: currentUser.email, time: nowISO() }); addActivity(`${c.unitId} trả kho · ${damaged ? 'có hư hại, chờ Manager quyết định' : 'kiểm tra đạt'}`); if (damaged) addNotification('Facility Manager', `Kho ${c.unitId} có hư hại sau khi trả, cần Manager quyết định chi phí.`, null, 'damage', null, getUnit(c.unitId)?.facility); closeModal(); renderPage('returns'); showToast(damaged ? 'Đã chuyển Manager xử lý hư hại.' : 'Trả kho hoàn tất; kho Available.'); }
function openDamageDecision(id) { if (!roleIs('Facility Manager')) return showToast('Facility Manager quyết định chi phí hư hại.'); const c = getContract(id); if (!c || c.status !== 'Damage Review') return; openModal('Quyết định hư hại', `<div class="notice">Facility Manager quyết định trách nhiệm và chi phí sửa chữa. <b>Customer phải thanh toán xong chi phí sửa chữa thì tiền cọc mới được hoàn.</b></div><label>Chi phí sửa chữa</label><input id="repairAmount" type="number" min="0" value="${state.fees.repairMinimum}"><label>Kết luận</label><textarea id="damageDecision" rows="3" placeholder="Ví dụ: Customer chịu chi phí thay khóa..."></textarea><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="saveDamageDecision('${c.id}')">Xác nhận quyết định</button></div>`) }
function saveDamageDecision(id) { const c = getContract(id), amount = Math.max(0, Number($('repairAmount').value)); if (!c || c.status !== 'Damage Review') return; c.damage = { amount, decision: $('damageDecision').value || 'Theo quyết định Facility Manager', status: 'Awaiting Customer Payment' }; state.extraCharges.push({ id: nextId('CHG', state.extraCharges), contractId: id, customer: c.customer, type: 'Repair', amount, status: 'Pending' }); addActivity(`Manager xác định phí sửa chữa ${c.unitId} · ${money(amount)}`, { customer: c.customer, facilityId: getUnit(c.unitId)?.facility, contractId: c.id, financial: true, category: 'fee' }); addNotification('Storage Customer', `Khoản sửa chữa ${c.unitId} là ${money(amount)}. Thanh toán trước khi hoàn cọc.`, null, 'repair', c.customer, getUnit(c.unitId)?.facility); closeModal(); renderPage('contracts'); showToast('Đã tạo khoản sửa chữa. Customer phải thanh toán trước khi hoàn cọc.'); }
function payExtraCharge(id) { if (!roleIs('Storage Customer')) return; const ch = state.extraCharges.find(x => x.id === id && x.customer === currentUser.email); if (!ch || ch.status !== 'Pending') return showToast('Khoản phí đã được thanh toán hoặc miễn.'); if (state.payments.some(p => p.kind === 'extra' && p.chargeId === id)) return showToast('Khoản phí chỉ được thanh toán một lần.'); const code = `SS-${ch.id}-EXTRA`.toUpperCase(); openModal('Thanh toán phí phát sinh · QR', `<div class="payment-card"><div><span>Charge</span><strong>${ch.id}</strong></div><div><span>Loại</span><strong>${esc(ch.type)}</strong></div><div><span>Số tiền</span><strong>${money(ch.amount)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN</span><h3>${code}</h3><p>Thanh toán một lần cho khoản phí này.</p></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeExtraChargePayment('${ch.id}','${code}')">Xác nhận đã thanh toán · ${money(ch.amount)}</button></div>`) }
function completeExtraChargePayment(id, code) { const ch = state.extraCharges.find(x => x.id === id && x.customer === currentUser.email); if (!ch || ch.status !== 'Pending') return showToast('Khoản phí không còn chờ thanh toán.'); if (state.payments.some(p => p.kind === 'extra' && p.chargeId === id)) return showToast('Khoản phí chỉ được thanh toán một lần.'); ch.status = 'Paid'; ch.paidAt = nowISO(); state.payments.push({ id: nextId('PAY', state.payments), customer: ch.customer, amount: ch.amount, status: 'Success', kind: 'extra', chargeId: id, paymentCode: code, method: 'QR Payment' }); addActivity(`Customer thanh toán phí ${ch.id} · ${money(ch.amount)}`, { customer: ch.customer, facilityId: getUnit(getContract(ch.contractId)?.unitId)?.facility, chargeId: ch.id, financial: true, category: 'payment' }); closeModal(); renderPage('payments'); showToast('Đã thanh toán phí phát sinh.'); }
function payDamage(id) { if (!roleIs('Storage Customer')) return; const ch = state.extraCharges.find(x => x.id === id && x.customer === currentUser.email); if (!ch || ch.status !== 'Pending') return showToast('Khoản phí đã được thanh toán.'); const code = `SS-${ch.id}-REPAIR`.toUpperCase(); openModal('Thanh toán sửa chữa · QR', `<div class="payment-card"><div><span>Charge</span><strong>${ch.id}</strong></div><div><span>Số tiền</span><strong>${money(ch.amount)}</strong></div></div><div class="qr-payment-screen"><div class="qr-large">${qrSvgFor(code)}</div><div class="qr-payment-info"><span class="eyebrow">MÃ THANH TOÁN</span><h3>${code}</h3><p>Thanh toán một lần cho khoản sửa chữa này.</p></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="completeDamagePayment('${ch.id}','${code}')">Xác nhận đã thanh toán · ${money(ch.amount)}</button></div>`) }
function completeDamagePayment(id, code) { const ch = state.extraCharges.find(x => x.id === id && x.customer === currentUser.email); if (!ch || ch.status !== 'Pending') return showToast('Khoản phí đã được thanh toán.'); if (state.payments.some(p => p.kind === 'repair' && p.chargeId === id)) return showToast('Khoản sửa chữa chỉ được thanh toán một lần.'); ch.status = 'Paid'; const c = getContract(ch.contractId); state.payments.push({ id: nextId('PAY', state.payments), customer: currentUser.email, amount: ch.amount, status: 'Success', kind: 'repair', chargeId: id, paymentCode: code, method: 'QR Payment' }); if (c) { c.damage.status = 'Paid'; c.depositRefunded = true; c.status = 'Completed'; getUnit(c.unitId).status = 'Available'; } addActivity(`Customer thanh toán sửa chữa ${money(ch.amount)} · tiền cọc được phép hoàn`, { customer: currentUser.email, facilityId: getUnit(getContract(ch.contractId)?.unitId)?.facility, contractId: ch.contractId, chargeId: ch.id, financial: true, category: 'payment' }); closeModal(); renderPage('payments'); showToast('Đã thanh toán sửa chữa. Tiền cọc được phép hoàn lại.'); }

function openExtraChargeModal() { if (!roleIs('Facility Staff') && !roleIs('Facility Manager')) return showToast('Chỉ Staff hoặc Facility Manager tạo phí phát sinh.'); const customers = [...new Set(state.contracts.filter(c => c.status === 'Active' && hasFacilityAccess(getUnit(c.unitId)?.facility)).map(c => c.customer))]; openModal('Tạo phí phát sinh', `<label>Customer</label><select id="chargeCustomer">${customers.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') || '<option value="">Chưa có customer active</option>'}</select><label>Loại phí</label><select id="chargeType" onchange="syncChargeAmount()"><option value="Extra Access Card">Thẻ truy cập thêm</option><option value="Lock Replacement">Thay khóa</option><option value="Other">Khác</option></select><label>Số tiền</label><input id="chargeAmount" type="number" min="0" value="${state.fees.extraAccessCard}"><label>Ghi chú</label><textarea id="chargeNote" rows="3" placeholder="Lý do phát sinh..."></textarea><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createExtraCharge()">Tạo khoản phí</button></div>`) }
function syncChargeAmount() { const t = $('chargeType').value; if (t === 'Extra Access Card') $('chargeAmount').value = state.fees.extraAccessCard; else if (t === 'Lock Replacement') $('chargeAmount').value = state.fees.lockReplacement; }
function createExtraCharge() { const customer = $('chargeCustomer').value, type = $('chargeType').value, amount = Math.max(0, Number($('chargeAmount').value)); if (!customer || amount <= 0) return showToast('Thông tin khoản phí không hợp lệ.'); const ch = { id: nextId('CHG', state.extraCharges), customer, type, amount, note: $('chargeNote').value || '', status: 'Pending', createdBy: currentUser.email, createdAt: nowISO() }; state.extraCharges.push(ch); addActivity(`${currentUser.role} tạo phí ${ch.id} · ${type} · ${money(amount)}`, { customer: ch.customer, facilityId: getUnit(getContract(ch.contractId)?.unitId)?.facility, chargeId: ch.id, financial: true, category: 'fee' }); addNotification('Storage Customer', `Bạn có khoản phí phát sinh ${ch.id}: ${money(amount)}.`, null, 'extra-charge', ch.customer, getUnit(getContract(ch.contractId)?.unitId)?.facility); closeModal(); renderPage('payments'); showToast('Đã tạo khoản phí. Customer có thể thanh toán.'); }

/* ---------------- Flow 5: Support / facility / staff ---------------- */
function openSupportModal() { if (!roleIs('Storage Customer')) return showToast('Customer tạo support request.'); openModal('Tạo yêu cầu hỗ trợ', `<label>Chủ đề</label><select id="supportType"><option>Unit</option><option>Lock / Access Code</option><option>Payment</option><option>Stored Items</option></select><label>Nội dung</label><textarea id="supportText" rows="4" placeholder="Mô tả vấn đề..."></textarea><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createSupport()">Gửi yêu cầu</button></div>`) }
function createSupport() { const s = { id: nextId('SUP', state.support), customer: currentUser.email, type: $('supportType').value, text: $('supportText').value || 'Cần hỗ trợ', status: 'Open', createdAt: nowISO() }; state.support.push(s); const fid = supportFacilityId(s); addActivity(`Customer tạo support ${s.id} · ${s.type}`, { customer: s.customer, facilityId: fid, category: 'support' }); addNotification('Facility Staff', `Có support request ${s.id} từ Customer cần xử lý.`, null, 'support', null, fid); closeModal(); renderPage('support'); showToast('Đã gửi yêu cầu hỗ trợ.'); }
function resolveSupport(id) { const s = state.support.find(x => x.id === id); if (!s) return; s.status = 'Resolved'; s.resolvedBy = currentUser.email; s.resolvedAt = nowISO(); addActivity(`Support ${id} được xử lý bởi ${currentUser.role}`); renderPage('support'); showToast('Đã đóng yêu cầu.'); }
function unitLocationOptions(facilityId, selected = '') { const f = getFacility(facilityId); const locs = f?.locations || []; return locs.map(l => `<option value="${esc(l)}" ${l === selected ? 'selected' : ''}>${esc(l)}</option>`).join('') || '<option value="">Chưa có vị trí</option>'; }
function openUnitModal() { if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager thêm kho.'); const f = state.facilities[0]; openModal('Thêm kho mới', `<div class="form-grid"><div><label>Mã kho</label><input id="newUnitId" placeholder="A-205"></div><div><label>Facility</label><select id="newUnitFacility" onchange="refreshNewUnitLocations()">${state.facilities.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div><label>Vị trí</label><div style="display:flex;gap:8px"><select id="newUnitLocation" style="flex:1">${unitLocationOptions(f.id)}</select><button type="button" class="mini-btn" onclick="addLocationFromUnitModal()">+ Thêm</button></div><small class="field-hint">Vị trí thuộc cơ sở đã chọn. Bạn có thể tự thêm Khu/Tầng mới.</small></div><div><label>Loại kho</label><select id="newUnitType"><option>Kho thường</option><option>Kho mát</option><option>Kho lạnh</option></select></div><div><label>Kích thước</label><input id="newUnitSize" value="4 m²"></div><div><label>Giá/tháng</label><input id="newUnitPrice" type="number" value="1200000"></div><div><label>Trạng thái</label><select id="newUnitStatus"><option>Available</option><option>Maintenance</option></select></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createUnit()">Thêm kho</button></div>`) }
function refreshNewUnitLocations() { const fid = $('newUnitFacility').value; const sel = $('newUnitLocation'); if (sel) sel.innerHTML = unitLocationOptions(fid); }
function addLocationFromUnitModal() { if (!roleIs('Facility Manager')) return; const fid = $('newUnitFacility').value; const f = getFacility(fid); const name = prompt('Nhập tên vị trí mới cho cơ sở này (ví dụ: Khu C, Tầng 3):', 'Khu mới'); if (!f || !name || !name.trim()) return; const clean = name.trim(); if (f.locations.some(x => x.toLowerCase() === clean.toLowerCase())) return showToast('Vị trí này đã tồn tại tại cơ sở.'); f.locations.push(clean); refreshNewUnitLocations(); $('newUnitLocation').value = clean; saveState(); addActivity(`Facility Manager thêm vị trí ${clean} tại ${f.name}`); showToast(`Đã thêm vị trí ${clean}.`); }
function createUnit() { const id = $('newUnitId').value.trim(); const facility = $('newUnitFacility').value; const location = $('newUnitLocation').value; if (!id) return showToast('Nhập mã kho.'); if (getUnit(id)) return showToast('Mã kho đã tồn tại.'); const type = $('newUnitType').value, size = $('newUnitSize').value.trim(), price = Number($('newUnitPrice').value); if (!location) return showToast('Hãy chọn vị trí kho.'); if (!size) return showToast('Nhập kích thước kho.'); if (price <= 0) return showToast('Giá kho phải lớn hơn 0.'); const u = { id, facility, type, climate: type, size, price, status: $('newUnitStatus').value, location }; state.units.push(u); saveState(); addActivity(`Facility Manager thêm kho ${u.id} tại ${location} · ${getFacility(facility).name}`); closeModal(); renderPage('units'); initPublicLanding(); showToast('Đã thêm kho. Nếu Available, Customer thấy ngay trên Đặt kho.'); }
function openEditUnitModal(id) { if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager sửa kho.'); const u = getUnit(id); if (!u) return; openModal(`Chỉnh sửa kho · ${u.id}`, `<div class="form-grid"><div><label>Facility</label><select id="editUnitFacility" onchange="refreshEditUnitLocations()">${state.facilities.map(f => `<option value="${f.id}" ${f.id === u.facility ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div><div><label>Vị trí</label><select id="editUnitLocation">${unitLocationOptions(u.facility, u.location)}</select><small class="field-hint">Có thể chọn vị trí đã tạo hoặc thêm vị trí mới từ lần tạo kho tiếp theo.</small></div><div><label>Loại kho</label><select id="editUnitType"><option ${u.type === 'Kho thường' ? 'selected' : ''}>Kho thường</option><option ${u.type === 'Kho mát' ? 'selected' : ''}>Kho mát</option><option ${u.type === 'Kho lạnh' ? 'selected' : ''}>Kho lạnh</option></select></div><div><label>Kích thước</label><input id="editUnitSize" value="${esc(u.size)}"></div><div><label>Giá/tháng</label><input id="editUnitPrice" type="number" value="${u.price}"></div><div><label>Trạng thái</label><select id="editUnitStatus"><option ${u.status === 'Available' ? 'selected' : ''}>Available</option><option ${u.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option><option ${u.status === 'Reserved' ? 'selected' : ''}>Reserved</option><option ${u.status === 'Rented' ? 'selected' : ''}>Rented</option></select></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="saveEditedUnit('${u.id}')">Lưu thay đổi</button></div>`) }
function refreshEditUnitLocations() { const fid = $('editUnitFacility').value; const sel = $('editUnitLocation'); if (sel) sel.innerHTML = unitLocationOptions(fid); }
function saveEditedUnit(id) { const u = getUnit(id); if (!u) return; const oldFacility = u.facility, newFacility = $('editUnitFacility').value, newStatus = $('editUnitStatus').value; if (!hasFacilityAccess(newFacility)) return showToast('Bạn không được phân quyền tại facility này.'); if (newFacility !== oldFacility && ((state.bookings || []).some(b => b.unitId === id && ['Pending Deposit', 'Pending Verification', 'Pending Approval', 'Approved', 'Paid', 'Handed Over'].includes(b.status)) || (state.contracts || []).some(c => c.unitId === id && ['Active', 'Return Requested', 'Damage Review'].includes(c.status)))) return showToast('Không thể chuyển facility khi kho đang có booking/hợp đồng.'); if (newStatus === 'Available' && unitHasOverlap(id, new Date().toISOString().slice(0, 10), '2999-12-31')) return showToast('Không thể đặt Available vì kho còn booking/hợp đồng.'); if (newStatus === 'Rented' && !state.contracts.some(c => c.unitId === id && c.status === 'Active')) return showToast('Không thể đặt Rented khi chưa có hợp đồng Active.'); const newLocation = $('editUnitLocation').value, newSize = $('editUnitSize').value.trim(), newPrice = Number($('editUnitPrice').value); if (!newLocation || !newSize || newPrice <= 0) return showToast('Thông tin kho không hợp lệ.'); u.facility = newFacility; u.location = newLocation; u.type = $('editUnitType').value; u.climate = u.type; u.size = newSize; u.price = newPrice; u.status = newStatus; saveState(); addActivity(`Facility Manager cập nhật kho ${u.id}`); closeModal(); renderPage('units'); initPublicLanding(); showToast('Đã cập nhật kho.'); }
function openAssignStaffModal() {
  if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager phân công Staff.');
  const facilities = state.facilities.filter(f => hasFacilityAccess(f.id));
  if (!facilities.length) return showToast('Bạn chưa được phân quyền quản lý facility nào.');
  // Staff không cần được cấp facility trước. Việc Facility Manager phân công sẽ cấp phạm vi facility cho Staff.
  const staffOptions = Object.entries(accounts)
    .filter(([_, a]) => a.role === 'Facility Staff' && a.status === 'Active')
    .map(([_, a]) => {
      const assigned = (a.facilityIds || []).filter(fid => fid !== '*').map(fid => getFacility(fid)?.name || fid);
      const suffix = assigned.length ? ` · Đang phụ trách: ${esc(assigned.join(', '))}` : '';
      return `<option value="${esc(a.email)}">${esc(a.name)} · ${esc(a.email)}${suffix}</option>`;
    }).join('');
  openModal('Phân công Facility Staff', `
    <div class="notice"><strong>Quy tắc phân công:</strong> Facility Manager chọn Staff đang hoạt động và cơ sở mình quản lý. Sau khi phân công, Staff tự động được cấp quyền làm việc tại facility đó.</div>
    <label>Facility Staff</label>
    <select id="assignStaff">${staffOptions || '<option value="">Chưa có Facility Staff đang hoạt động</option>'}</select>
    <label>Facility</label>
    <select id="assignFacility">${facilities.map(f => `<option value="${f.id}">${esc(f.name)} · ${esc(f.address || '')}</option>`).join('')}</select>
    <label>Nhiệm vụ</label>
    <select id="assignTask"><option>Check-in / Handover</option><option>Return Inspection</option><option>Support</option><option>Daily Operations</option></select>
    <div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="saveAssignment()">Phân công</button></div>`
  )
}
function saveAssignment() {
  if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager phân công Staff.');
  const staffEmail = $('assignStaff')?.value, facilityId = $('assignFacility')?.value, task = $('assignTask')?.value;
  const staff = Object.values(accounts).find(a => a.email === staffEmail);
  if (!staff || staff.role !== 'Facility Staff' || staff.status !== 'Active') return showToast('Facility Staff không hợp lệ hoặc chưa được Admin kích hoạt.');
  if (!facilityId || !hasFacilityAccess(facilityId)) return showToast('Bạn không có quyền phân công tại facility này.');
  const existing = state.staffAssignments.find(a => a.staff === staffEmail && a.facility === facilityId && a.task === task && a.status === 'Assigned');
  if (existing) return showToast('Staff đã được phân công nhiệm vụ này tại facility.');
  const a = { id: nextId('ASN', state.staffAssignments), staff: staffEmail, facility: facilityId, task, status: 'Assigned', assignedBy: currentUser.email, assignedAt: nowISO() };
  state.staffAssignments.push(a);
  staff.facilityIds = Array.isArray(staff.facilityIds) ? staff.facilityIds : [];
  if (!staff.facilityIds.includes('*') && !staff.facilityIds.includes(facilityId)) staff.facilityIds.push(facilityId);
  saveAccounts(); saveState();
  addActivity(`Manager phân công ${task} cho ${staffEmail} tại ${getFacility(facilityId)?.name || facilityId}`, { facilityId, category: 'staff' });
  addNotification('Facility Staff', `Bạn được phân công ${task} tại ${getFacility(facilityId)?.name || facilityId}.`, null, 'staff-assignment', staffEmail, facilityId);
  closeModal(); renderPage('staff'); showToast(`Đã phân công ${staff.name} tại ${getFacility(facilityId)?.name || facilityId}.`);
}
function revokeStaffAssignment(id) {
  if (!roleIs('Facility Manager')) return showToast('Chỉ Facility Manager hủy phân công.');
  const a = state.staffAssignments.find(x => x.id === id); if (!a || !hasFacilityAccess(a.facility)) return showToast('Bạn không có quyền với phân công này.');
  a.status = 'Revoked'; a.revokedAt = nowISO(); a.revokedBy = currentUser.email;
  const stillAssigned = state.staffAssignments.some(x => x.id !== id && x.staff === a.staff && x.facility === a.facility && x.status === 'Assigned');
  const staff = Object.values(accounts).find(x => x.email === a.staff);
  if (staff && !stillAssigned && Array.isArray(staff.facilityIds)) staff.facilityIds = staff.facilityIds.filter(fid => fid !== a.facility);
  saveAccounts(); saveState(); addActivity(`Manager hủy phân công ${a.task} của ${a.staff}`, { facilityId: a.facility, category: 'staff' }); addNotification('Facility Staff', `Phân công ${a.task} tại ${getFacility(a.facility)?.name || a.facility} đã được hủy.`, null, 'staff-assignment', a.staff, a.facility); renderPage('staff'); showToast('Đã hủy phân công.');
}
function openFacilityModal() { if (!roleIs('Business Operations Manager')) return showToast('Chỉ Operations Manager thêm facility.'); openModal('Thêm cơ sở', `<label>Tên cơ sở</label><input id="newFacilityName" placeholder="Bình Thạnh"><label>Địa chỉ</label><input id="newFacilityAddress" placeholder="HCMC"><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="createFacility()">Thêm cơ sở</button></div>`) }
function createFacility() { const f = { id: nextId('F', state.facilities), name: $('newFacilityName').value || 'New Facility', address: $('newFacilityAddress').value || 'HCMC', status: 'Active', locations: [] }; state.facilities.push(f); addActivity(`Operations Manager thêm cơ sở ${f.name}`); closeModal(); renderPage('facilities'); initPublicLanding(); showToast('Facility mới đã được thêm.'); }
function openPolicyModal() { if (!roleIs('Business Operations Manager')) return showToast('Chỉ Operations Manager cấu hình policy.'); openModal('Chính sách hệ thống', `<div class="form-grid"><div><label>Deposit (số tháng)</label><input id="policyDeposit" type="number" min="1" value="${state.policies.depositMonths}"></div><div><label>Cancellation trước (giờ)</label><input id="policyCancel" type="number" min="0" value="${state.policies.cancellationHours}"></div><div><label>Overdue/ngày</label><input id="policyOverdue" type="number" min="0" value="${state.policies.overdueDaily}"></div><div><label>Renewal fee</label><input id="policyRenew" type="number" min="0" value="${state.policies.renewalFee}"></div><div><label>Cho phép miễn/giảm phí</label><select id="policyWaiver"><option value="true" ${state.policies.feeWaiverEnabled ? 'selected' : ''}>Có</option><option value="false" ${!state.policies.feeWaiverEnabled ? 'selected' : ''}>Không</option></select></div><div><label>Mức giảm tối đa (%)</label><input id="policyWaiverMax" type="number" min="0" max="100" value="${state.policies.feeWaiverMaxPercent}"></div></div><div class="notice">Policy áp dụng cho reservation/hợp đồng mới.</div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="savePolicy()">Lưu policy</button></div>`) }
function savePolicy() { state.policies.depositMonths = Math.max(1, Number($('policyDeposit').value)); state.policies.cancellationHours = Math.max(0, Number($('policyCancel').value)); state.policies.overdueDaily = Math.max(0, Number($('policyOverdue').value)); state.policies.renewalFee = Math.max(0, Number($('policyRenew').value)); state.policies.feeWaiverEnabled = $('policyWaiver').value === 'true'; state.policies.feeWaiverMaxPercent = Math.min(100, Math.max(0, Number($('policyWaiverMax').value))); addActivity('Operations Manager cập nhật system policies'); closeModal(); renderPage('policies'); showToast('Policy đã cập nhật.'); }
function openFeeModal() { if (!roleIs('Business Operations Manager')) return showToast('Chỉ Operations Manager quản lý fee.'); openModal('Biểu phí', `<div class="form-grid"><div><label>Discount %</label><input id="feeDiscount" type="number" min="0" value="${state.fees.discountPercent}"></div><div><label>Access card</label><input id="feeCard" type="number" min="0" value="${state.fees.extraAccessCard}"></div><div><label>Thay khóa</label><input id="feeLock" type="number" min="0" value="${state.fees.lockReplacement}"></div><div><label>Repair minimum</label><input id="feeRepair" type="number" min="0" value="${state.fees.repairMinimum}"></div></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Hủy</button><button class="primary-btn" onclick="saveFees()">Lưu biểu phí</button></div>`) }
function saveFees() { state.fees.discountPercent = Math.max(0, Number($('feeDiscount').value)); state.fees.extraAccessCard = Math.max(0, Number($('feeCard').value)); state.fees.lockReplacement = Math.max(0, Number($('feeLock').value)); state.fees.repairMinimum = Math.max(0, Number($('feeRepair').value)); addActivity('Operations Manager cập nhật fee schedule'); closeModal(); renderPage('fees'); showToast('Biểu phí đã cập nhật.'); }

function updateAccountStatus(key, status) {
  if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator quản lý tài khoản.');
  const a = accounts[key]; if (!a) return;
  if (a.role === 'System Administrator' && status !== 'Active') return showToast('Không thể khóa tài khoản System Administrator demo.');
  a.status = status; saveAccounts(); addActivity(`Admin cập nhật ${a.email} → ${status}`); renderPage('users'); showToast(`Đã cập nhật trạng thái ${status}.`);
}
function approveAccountRequest(key) {
  if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator duyệt tài khoản.');
  const a = accounts[key]; if (!a || a.status !== 'Pending Approval') return showToast('Yêu cầu không còn chờ duyệt.');
  const role = a.requestedRole || a.role; a.role = role; a.permissions = accountPermissionsForRole(role); a.status = 'Active'; a.approvalStatus = 'Approved'; a.approvedBy = currentUser.email; a.approvedAt = nowISO(); a.requestedRole = null; saveAccounts(); addActivity(`Admin duyệt tài khoản ${a.email} → ${role}`); addNotification(role, `Tài khoản của bạn đã được Admin duyệt role ${role}.`, null, 'account-approved', a.email); renderPage('users'); showToast('Đã duyệt tài khoản.');
}
function rejectAccountRequest(key) {
  if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator duyệt tài khoản.');
  const a = accounts[key]; if (!a || a.status !== 'Pending Approval') return showToast('Yêu cầu không còn chờ duyệt.');
  a.status = 'Rejected'; a.approvalStatus = 'Rejected'; a.rejectedBy = currentUser.email; a.rejectedAt = nowISO(); saveAccounts(); addActivity(`Admin từ chối yêu cầu tài khoản ${a.email}`); renderPage('users'); showToast('Đã từ chối yêu cầu.');
}
function changeAccountRole(key, role) {
  if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator phân quyền.');
  const a = accounts[key]; if (!a || a.role === 'System Administrator') return showToast('Không thể đổi role System Administrator demo.');
  if (!ROLE_PERMISSIONS[role]) return;
  a.role = role; a.requestedRole = null; a.permissions = accountPermissionsForRole(role); a.status = 'Active'; a.approvalStatus = 'Approved'; saveAccounts(); addActivity(`Admin đổi role ${a.email} → ${role}`); renderPage('users'); showToast('Role đã được cập nhật.');
}
function toggleAccountFacility(key, facilityId) { if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator phân quyền facility.'); const a = accounts[key]; if (!a || a.role === 'System Administrator' || a.role === 'Business Operations Manager') return; a.facilityIds = a.facilityIds || []; a.facilityIds.includes(facilityId) ? a.facilityIds = a.facilityIds.filter(x => x !== facilityId) : a.facilityIds.push(facilityId); saveAccounts(); addActivity(`Admin cập nhật facility access ${facilityId} cho ${a.email}`); renderPage('users'); }
function toggleAccountPermission(key, permission) {
  if (!roleIs('System Administrator')) return showToast('Chỉ System Administrator phân quyền.');
  const a = accounts[key]; if (!a || a.role === 'System Administrator') return showToast('Không chỉnh quyền System Administrator demo.');
  a.permissions = a.permissions || []; a.permissions.includes(permission) ? a.permissions = a.permissions.filter(x => x !== permission) : a.permissions.push(permission); saveAccounts(); addActivity(`Admin cập nhật permission ${permission} cho ${a.email}`); renderPage('users');
}
function renderActivity() { if (!roleIs('System Administrator')) return '<div class="panel"><div class="empty-state">Bạn không có quyền xem activity logs.</div></div>'; const rows = (state.activities || []).filter(a => !a.financial); return `<div class="panel"><div class="panel-head"><h3>System Activity Logs</h3><p class="muted">Nhật ký hoạt động hệ thống, không hiển thị giao dịch tài chính.</p></div>${rows.length ? `<table class="table"><thead><tr><th>Time</th><th>Actor</th><th>Activity</th><th>Facility</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(a.time)}</td><td>${esc(a.actorEmail || 'System')}</td><td>${esc(a.text)}</td><td>${esc(getFacility(a.facilityId)?.name || 'System')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Chưa có log hoạt động.</div>'}</div>` }
function renderUsers() {
  if (!roleIs('System Administrator')) return '<div class="panel"><div class="empty-state">Bạn không có quyền quản lý tài khoản.</div></div>';
  normalizeAccounts();
  const entries = Object.entries(accounts);
  const pending = entries.filter(([k, a]) => a.status === 'Pending Approval');
  const roleOptions = SELF_REQUESTABLE_ROLES.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  const allPermissions = [...new Set(Object.values(ROLE_PERMISSIONS).flat())];
  return `<div class="grid-2"><div class="panel"><div class="panel-head"><div><h3>Yêu cầu tài khoản</h3><p class="muted">Các role ngoài Storage Customer phải được System Administrator duyệt.</p></div><span class="badge ${pending.length ? 'warning' : 'success'}">${pending.length} chờ duyệt</span></div>${pending.length ? `<table class="table"><thead><tr><th>Người đăng ký</th><th>Email</th><th>Role yêu cầu</th><th>Trạng thái</th><th></th></tr></thead><tbody>${pending.map(([k, a]) => `<tr><td><strong>${esc(a.name)}</strong></td><td>${esc(a.email)}</td><td>${esc(a.requestedRole || a.role)}</td><td>${badge(a.status)}</td><td><button class="mini-btn" onclick="approveAccountRequest('${k}')">Duyệt</button> <button class="mini-btn" onclick="rejectAccountRequest('${k}')">Từ chối</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Không có yêu cầu mới.</div>`}</div><div class="panel"><div class="panel-head"><div><h3>Quản trị tài khoản</h3><p class="muted">Ban, tạm ngưng, kích hoạt và điều chỉnh role/quyền.</p></div></div>${entries.map(([k, a]) => `<div class="account-admin-card"><div class="account-admin-head"><div><strong>${esc(a.name)}</strong><p>${esc(a.email)}</p><small>${esc(a.role)} · ${badge(a.status)}</small></div><div class="account-admin-actions">${a.role !== 'System Administrator' ? `<button class="mini-btn" onclick="updateAccountStatus('${k}','Active')">Kích hoạt</button><button class="mini-btn" onclick="updateAccountStatus('${k}','Suspended')">Hạn chế</button><button class="mini-btn" onclick="updateAccountStatus('${k}','Banned')">Ban</button>` : '<span class="muted">Admin protected</span>'}</div></div>${a.role !== 'System Administrator' ? `<div class="account-admin-controls"><label>Role <select onchange="changeAccountRole('${k}',this.value)">${SELF_REQUESTABLE_ROLES.map(r => `<option value="${esc(r)}" ${a.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label><div><span class="muted">Facility access:</span><div class="permission-chips">${state.facilities.map(f => `<button type="button" class="permission-chip ${a.facilityIds?.includes(f.id) ? 'active' : ''}" onclick="toggleAccountFacility('${k}','${f.id}')">${esc(f.name)}</button>`).join('')}</div></div><div><span class="muted">Permissions:</span><div class="permission-chips">${allPermissions.map(p => `<button type="button" class="permission-chip ${a.permissions?.includes(p) ? 'active' : ''}" onclick="toggleAccountPermission('${k}','${p}')">${p}</button>`).join('')}</div></div></div>` : ''}</div>`).join('')}</div></div>`;
}

/* ---------------- Pages ---------------- */
function genericPage(page) {
  if (page === 'my-units') return renderMyUnits();
  if (page === 'reservations') return renderReservations();
  if (page === 'payments') return renderPayments();
  if (page === 'check-in') return `<div class="panel"><div class="panel-head"><h3>Bookings chờ bàn giao</h3></div>${staffTaskTable()}</div>`;
  if (page === 'returns') return renderReturns();
  if (page === 'support') return renderSupport();
  if (page === 'daily-tasks') return renderDailyTasks();
  if (page === 'units') return renderUnits();
  if (page === 'customers') return renderCustomers();
  if (page === 'contracts') return renderContracts();
  if (page === 'staff') return renderStaff();
  if (page === 'facilities') return renderFacilities();
  if (page === 'policies') return renderPolicies();
  if (page === 'fees') return renderFees();
  if (page === 'revenue') return renderRevenue();
  if (page === 'reports' || page === 'operations') return renderOperationsReports();
  if (page === 'users') return renderUsers();
  if (page === 'activity') return renderActivity();
  const descriptions = { roles: 'Quản lý 5 role của hệ thống.', permissions: 'Cấu hình quyền truy cập.', activity: 'Theo dõi activity logs.', system: 'Cấu hình hệ thống và bảo mật.', settings: 'Thiết lập tài khoản.' };
  return `<div class="panel" style="min-height:300px"><div class="panel-head"><h3>${esc(labels()[page] || page)}</h3></div><p class="muted">${descriptions[page] || 'Nội dung quản lý.'}</p><div class="demo-note"><strong>Role-based access đang hoạt động</strong><p>${esc(currentUser.email)} · ${esc(currentUser.role)}</p></div></div>`;
}
function publicScroll(id) {
  const el = $(id); if (!el) return;
  document.querySelector('.public-nav')?.classList.remove('open');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function focusPublicSearch() { publicScroll('bookingCatalog'); setTimeout(() => $('publicStorageSearch')?.focus(), 450) }
function handlePublicBook(unitId) {
  if (!currentUser) return requireLogin({ type: 'book', unitId });
  if (!roleIs('Storage Customer')) return showToast('Chỉ Storage Customer có thể đặt kho.');
  openBookingModal(unitId);
}
function publicUnitImage(u) { const k = climateOf(u) === 'Kho lạnh' ? 'cold' : climateOf(u) === 'Kho mát' ? 'cool' : 'normal'; return `assets/storage-${k}.svg` }
function renderPublicCatalog() {
  const box = $('publicStorageCatalog'); if (!box) return;
  const q = ($('publicStorageSearch')?.value || '').trim().toLowerCase(), climate = $('publicClimate')?.value || '', size = $('publicSize')?.value || '', facility = $('publicFacility')?.value || '';
  const units = state.units.filter(u => u.status === 'Available' && (!facility || u.facility === facility));
  const score = u => { const hay = `${u.id} ${climateOf(u)} ${u.size} ${getFacility(u.facility)?.name || ''}`.toLowerCase(); let n = 0; if (q && hay.includes(q)) n += 5; if (climate && climateOf(u) === climate) n += 3; if (size && sizeNumber(u.size) === Number(size)) n += 3; if (facility && u.facility === facility) n += 2; return n };
  const sorted = [...units].sort((a, b) => score(b) - score(a) || a.price - b.price);
  if ($('publicCatalogCount')) $('publicCatalogCount').textContent = `${sorted.length} kho Available`;
  if ($('heroAvailableCount')) $('heroAvailableCount').textContent = sorted.length;
  box.innerHTML = sorted.length ? sorted.map(u => { const match = score(u) > 0; return `<article class="public-product-card ${match ? 'preferred' : ''}"><div class="public-product-photo"><img src="${publicUnitImage(u)}" alt="${esc(climateOf(u))}"><span>${esc(climateOf(u))}</span></div><div class="public-product-body"><div class="public-product-top"><span class="public-product-type">Available · ${esc(u.size)}</span>${match && (q || climate || size) ? '<span class="match-label">Phù hợp</span>' : ''}</div><h3>${esc(u.id)}</h3><p>${esc(getFacility(u.facility)?.name || u.facility)} · ${esc(u.location || 'Chưa có vị trí')} · ${esc(u.size)} · Có thể đặt theo thời gian thuê</p><div class="public-product-price">${money(u.price)} <small>/ tháng</small></div><button class="primary-btn public-product-btn" onclick="handlePublicBook('${u.id}')">Xem & đặt kho →</button><div class="public-login-hint">Cần tài khoản để thực hiện đặt kho</div></div></article>` }).join('') : `<div class="empty-state">Hiện không có kho Available.</div>`;
}
function renderPublicFacilities() {
  const box = $('publicFacilities'); if (!box) return;
  box.innerHTML = state.facilities.map(f => { const units = state.units.filter(u => u.facility === f.id), available = units.filter(u => u.status === 'Available').length; return `<article class="facility-public-card"><div><div class="facility-icon">⌂</div><h3>${esc(f.name)}</h3><p>${esc(f.address)}</p><p>${available} kho đang Available · ${units.length} kho tổng cộng</p></div><div class="facility-number">${String(f.id).replace('F', '0')}</div></article>` }).join('') || '<div class="empty-state">Chưa có cơ sở.</div>';
}
function initPublicLanding() { const sel = $('publicFacility'); if (sel) { const current = sel.value; sel.innerHTML = '<option value="">Tất cả cơ sở</option>' + state.facilities.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join(''); if (state.facilities.some(f => f.id === current)) sel.value = current; } renderPublicCatalog(); renderPublicFacilities() }

function renderReservations() {
  if (roleIs('Storage Customer')) {
    const myBookings = state.bookings.filter(x => x.customer === currentUser.email);
    return `<div class="storage-marketplace"><div class="market-head"><div><span class="eyebrow">STORAGE MARKETPLACE</span><h2>Chọn kho lưu trữ</h2><p class="muted">Tất cả kho đang Available luôn hiển thị. Search chỉ ưu tiên kho phù hợp lên đầu.</p></div></div><div class="market-search"><span>⌕</span><input id="pageStorageSearch" oninput="renderStoragePageCatalog()" placeholder="Tìm kho, loại kho, kích cỡ, cơ sở..."/><select id="pageFacility" onchange="renderStoragePageCatalog()"><option value="">Tất cả cơ sở</option>${state.facilities.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><select id="pageClimate" onchange="renderStoragePageCatalog()"><option value="">Tất cả loại kho</option><option>Kho thường</option><option>Kho mát</option><option>Kho lạnh</option></select><select id="pageSize" onchange="renderStoragePageCatalog()"><option value="">Tất cả kích cỡ</option><option value="2">2 m²</option><option value="4">4 m²</option><option value="6">6 m²</option><option value="8">8 m²</option><option value="10">10 m²</option></select></div><div class="catalog-heading"><strong>Tất cả kho đang Available</strong><span id="catalogCount" class="muted"></span></div><div id="pageStorageCatalog" class="storage-product-grid"></div>${myBookings.length ? `<div class="panel my-bookings-panel"><div class="panel-head"><h3>Đơn đặt kho của tôi</h3></div><table class="table"><thead><tr><th>ID</th><th>Kho</th><th>Thời gian</th><th>Trạng thái</th><th>Action</th></tr></thead><tbody>${myBookings.map(b => `<tr><td>${b.id}</td><td>${b.unitId}</td><td>${b.start} → ${b.end}</td><td>${badge(b.status)}</td><td>${b.status === 'Pending Deposit' ? `<button class="mini-btn" onclick="openDepositPayment('${b.id}')">Đặt cọc</button>` : ''}${b.status === 'Approved' && !b.rentPaymentPaid ? `<button class="mini-btn" onclick="openPaymentModal('${b.id}')">Thanh toán tiền thuê</button>` : ''}${b.status === 'Paid' ? `<span class="muted">✓ Đã thanh toán · chờ Staff bàn giao</span>` : ''}${b.status === 'Handed Over' ? `<span class="muted">✓ Đã bàn giao</span>` : ''}${b.status === 'Pending Approval' ? `<span class="muted">Chờ Manager duyệt</span>` : ''}${b.status === 'Rejected' ? `<span class="muted">Đã từ chối</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  }
  const rows = state.bookings; return `<div class="panel"><div class="panel-head"><h3>Reservations</h3></div>${rows.length ? `<table class="table"><thead><tr><th>ID</th><th>Customer</th><th>Unit</th><th>Period</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(b => `<tr><td>${b.id}</td><td>${esc(b.customer)}</td><td>${b.unitId}</td><td>${b.start} → ${b.end}</td><td>${badge(b.status)}</td><td>${roleIs('Facility Manager') && b.status === 'Pending Approval' ? `<button class="mini-btn" onclick="approveBooking('${b.id}')">Duyệt</button> <button class="mini-btn" onclick="rejectBooking('${b.id}')">Từ chối</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có reservation.</div>`}</div>`;
}
function renderStoragePageCatalog() {
  const box = $('pageStorageCatalog'); if (!box) return; const q = ($('pageStorageSearch')?.value || '').trim().toLowerCase(), climate = $('pageClimate')?.value || '', size = $('pageSize')?.value || '', facility = $('pageFacility')?.value || '', units = state.units.filter(u => u.status === 'Available' && (!facility || u.facility === facility));
  const score = u => { const hay = `${u.id} ${climateOf(u)} ${u.size} ${getFacility(u.facility)?.name || ''}`.toLowerCase(); let n = 0; if (q && hay.includes(q)) n += 5; if (climate && climateOf(u) === climate) n += 3; if (size && sizeNumber(u.size) === Number(size)) n += 3; if (facility && u.facility === facility) n += 2; return n };
  const sorted = [...units].sort((a, b) => score(b) - score(a) || a.price - b.price); if ($('catalogCount')) $('catalogCount').textContent = `${sorted.length} kho`;
  box.innerHTML = sorted.length ? sorted.map(u => { const match = score(u) > 0, kind = climateOf(u) === 'Kho lạnh' ? 'cold' : climateOf(u) === 'Kho mát' ? 'cool' : 'normal', image = kind === 'cold' ? 'assets/storage-cold.svg' : kind === 'cool' ? 'assets/storage-cool.svg' : 'assets/storage-normal.svg'; return `<article class="storage-product ${match ? 'preferred' : ''}"><div class="product-photo"><img src="${image}" alt="Hình ảnh ${esc(climateOf(u))}"><span class="photo-tag">${esc(climateOf(u))}</span></div><div class="product-body"><div class="product-top"><span class="product-type">${esc(climateOf(u))}</span>${match && (q || climate || size) ? '<span class="match-label">Phù hợp</span>' : ''}</div><h3>${esc(u.id)}</h3><p>${esc(getFacility(u.facility)?.name || u.facility)} · ${esc(u.location || 'Chưa có vị trí')} · ${esc(u.size)}</p><strong>${money(u.price)} <small>/ tháng</small></strong><button class="primary-btn product-btn" onclick="openBookingModal('${u.id}')">Xem & chọn kho</button></div></article>` }).join('') : `<div class="empty-state">Hiện không có kho Available.</div>`;
}
function waiveExtraCharge(id) { if (!roleIs('Business Operations Manager')) return showToast('Chỉ Business Operations Manager được miễn/giảm phí.'); if (!state.policies.feeWaiverEnabled) return showToast('Policy hiện không cho phép miễn/giảm phí.'); const ch = state.extraCharges.find(x => x.id === id); if (!ch || ch.status !== 'Pending') return showToast('Khoản phí không còn chờ xử lý.'); const percent = Math.min(100, Math.max(0, Number(state.policies.feeWaiverMaxPercent) || 0)); ch.status = 'Waived'; ch.waivedPercent = percent; ch.waivedBy = currentUser.email; ch.waivedAt = nowISO(); ch.waivedAmount = ch.amount; addActivity(`Operations Manager miễn ${percent}% phí ${ch.id}`); renderPage('payments'); showToast(`Đã miễn/giảm phí ${ch.id}.`); }
function renderPayments() { const managerCharges = state.extraCharges.filter(x => x.status === 'Pending'); const rows = state.payments.filter(x => roleIs('Storage Customer') ? x.customer === currentUser.email : true), charges = state.extraCharges.filter(x => x.status === 'Pending' && (!roleIs('Storage Customer') || x.customer === currentUser.email)), renewals = state.renewals.filter(x => x.status === 'Pending Payment' && (!roleIs('Storage Customer') || x.customer === currentUser.email)), pending = rows.filter(p => p.status === 'Pending Verification' && p.kind === 'rent'); return `<div class="grid-2"><div class="panel"><div class="panel-head"><h3>Payment records</h3></div>${rows.length ? `<table class="table"><thead><tr><th>ID</th><th>Loại</th><th>Booking/Charge</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p => `<tr><td>${p.id}</td><td>${p.kind}</td><td>${p.bookingId || p.chargeId || p.renewalId || p.scheduleId || '—'}</td><td><strong>${money(p.amount)}</strong></td><td>${badge(p.status)}</td><td>${p.status === 'Pending Verification' && roleIs('Storage Customer') ? `<button class="mini-btn" onclick="verifyRentPayment('${p.bookingId}','${esc(p.paymentCode)}')">Kiểm tra giao dịch</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có payment.</div>`}</div>${roleIs('Storage Customer') && (charges.length || renewals.length || pending.length) ? panel('Khoản cần xử lý', `${pending.map(p => `<div class="confirmation-box"><div><strong>Chờ xác minh ${p.bookingId}</strong><p>${money(p.amount)} · mã ${esc(p.paymentCode)}</p></div><button class="mini-btn" onclick="verifyRentPayment('${p.bookingId}','${esc(p.paymentCode)}')">Xác minh</button></div>`).join('')}${charges.map(c => `<div class="confirmation-box"><div><strong>${c.type}</strong><p>${money(c.amount)}</p></div><button class="mini-btn" onclick="${c.type === 'Repair' ? 'payDamage' : 'payExtraCharge'}('${c.id}')">Thanh toán</button></div>`).join('')}${renewals.map(r => `<div class="confirmation-box"><div><strong>Gia hạn ${r.id}</strong><p>${money(r.amount)}</p></div><button class="mini-btn" onclick="openRenewalPayment('${r.id}')">Thanh toán</button></div>`).join('')}`) : panel('Payment policy', 'Mỗi khoản thanh toán có một mã QR duy nhất. Giao dịch Pending Verification chưa được tính là thanh toán thành công và chưa được phép bàn giao. Khoản đã Success không xuất hiện lại để thanh toán.')}</div>${roleIs('Business Operations Manager') ? panel('Fee waiver queue', managerCharges.length ? managerCharges.map(c => `<div class="confirmation-box"><div><strong>${esc(c.id)} · ${esc(c.type)}</strong><p>${money(c.amount)} · ${esc(c.customer)}</p></div><button class="mini-btn" onclick="waiveExtraCharge('${c.id}')">Miễn/giảm phí</button></div>`).join('') : '<div class="empty-state">Không có phí chờ miễn/giảm.</div>') : ''}` }
function renderReturns() { const damaged = state.contracts.filter(c => c.status === 'Damage Review' && (!roleIs('Facility Manager') || hasFacilityAccess(getUnit(c.unitId)?.facility))); return `<div class="panel"><div class="panel-head"><h3>Return & Inspection</h3></div>${damaged.length ? `<table class="table"><thead><tr><th>Contract</th><th>Unit</th><th>Customer</th><th>Status</th><th></th></tr></thead><tbody>${damaged.map(c => `<tr><td>${c.id}</td><td>${c.unitId}</td><td>${esc(c.customer)}</td><td>${badge(c.status)}</td><td>${roleIs('Facility Manager') ? `<button class="mini-btn" onclick="openDamageDecision('${c.id}')">Quyết định phí</button>` : 'Chờ Manager'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Không có case hư hại cần xử lý.</div>`}</div>` }
function renderSupport() { const rows = state.support.filter(x => { if (roleIs('Storage Customer')) return x.customer === currentUser.email; if (roleIs('Facility Staff') || roleIs('Facility Manager')) return hasFacilityAccess(supportFacilityId(x)); return true }); return `<div class="panel"><div class="panel-head"><h3>Support Requests</h3></div>${rows.length ? `<table class="table"><thead><tr><th>ID</th><th>Customer</th><th>Type</th><th>Content</th><th>Facility</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(s => `<tr><td>${s.id}</td><td>${esc(s.customer)}</td><td>${esc(s.type)}</td><td>${esc(s.text)}</td><td>${esc(getFacility(supportFacilityId(s))?.name || '—')}</td><td>${badge(s.status)}</td><td>${!roleIs('Storage Customer') && s.status !== 'Resolved' ? `<button class="mini-btn" onclick="resolveSupport('${s.id}')">Xử lý</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có support request trong phạm vi được phép.</div>`}</div>` }
function renderDailyTasks() { return `<div class="panel"><div class="panel-head"><h3>Công việc hôm nay</h3></div>${state.staffAssignments.filter(x => x.staff === currentUser.email).map(a => `<div class="confirmation-box"><div><strong>${a.task}</strong><p>${getFacility(a.facility)?.name || a.facility}</p></div>${badge(a.status)}</div>`).join('') || '<div class="empty-state">Chưa có task được phân công.</div>'}</div>` }
function renderUnits() { return `<div class="panel"><div class="panel-head"><div><h3>Danh sách kho</h3><p class="muted">Quản lý loại, kích thước, vị trí, giá và trạng thái.</p></div></div><table class="table"><thead><tr><th>Unit</th><th>Facility</th><th>Vị trí</th><th>Type</th><th>Size</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${facilityScopedUnits().map(u => `<tr><td><strong>${u.id}</strong></td><td>${esc(getFacility(u.facility)?.name || u.facility)}</td><td>${esc(u.location || '—')}</td><td>${esc(u.type)}</td><td>${esc(u.size)}</td><td>${money(u.price)}</td><td>${badge(u.status)}</td><td><button class="mini-btn" onclick="openEditUnitModal('${u.id}')">Sửa</button></td></tr>`).join('')}</tbody></table></div>` }
function renderCustomers() { const customers = new Set([...state.bookings.map(x => x.customer), ...state.contracts.map(x => x.customer)]); return `<div class="panel"><div class="panel-head"><h3>Customers</h3></div><table class="table"><thead><tr><th>Email</th><th>Bookings</th><th>Contracts</th><th>Support</th></tr></thead><tbody>${[...customers].map(e => `<tr><td>${esc(e)}</td><td>${state.bookings.filter(x => x.customer === e).length}</td><td>${state.contracts.filter(x => x.customer === e).length}</td><td>${state.support.filter(x => x.customer === e).length}</td></tr>`).join('') || '<tr><td colspan="4">Chưa có customer activity.</td></tr>'}</tbody></table></div>` }
function renderContracts() { const rows = roleIs('Facility Manager') ? state.contracts.filter(c => hasFacilityAccess(getUnit(c.unitId)?.facility)) : state.contracts; return `<div class="panel"><div class="panel-head"><h3>Contracts</h3></div>${rows.length ? `<table class="table"><thead><tr><th>ID</th><th>Unit</th><th>Vị trí</th><th>Customer</th><th>Period</th><th>Payment</th><th>Status</th><th>Damage</th></tr></thead><tbody>${rows.map(c => `<tr><td>${c.id}</td><td>${c.unitId}</td><td>${esc(getUnit(c.unitId)?.location || '—')}</td><td>${esc(c.customer)}</td><td>${c.start} → ${c.end}</td><td>${c.paymentPlan === 'Periodic' ? 'Theo chu kỳ' : 'Đã/ sẽ trả một lần'}</td><td>${badge(c.status)}</td><td>${c.damage ? money(c.damage.amount) : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có hợp đồng.</div>`}</div>` }
function renderStaff() { const rows = roleIs('Facility Manager') ? state.staffAssignments.filter(a => hasFacilityAccess(a.facility)) : state.staffAssignments; return `<div class="panel"><div class="panel-head"><div><h3>Phân công Facility Staff</h3><p class="muted">Staff chỉ nhận task tại các facility đã được Facility Manager phân công.</p></div><button class="mini-btn" onclick="openAssignStaffModal()">+ Phân công Staff</button></div>${rows.length ? `<table class="table"><thead><tr><th>Staff</th><th>Facility</th><th>Task</th><th>Người phân công</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(a.staff)}</td><td>${esc(getFacility(a.facility)?.name || a.facility)}</td><td>${esc(a.task)}</td><td>${esc(a.assignedBy || '—')}</td><td>${badge(a.status)}</td><td>${roleIs('Facility Manager') && a.status === 'Assigned' ? `<button class="mini-btn" onclick="revokeStaffAssignment('${a.id}')">Hủy</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có phân công. Hãy chọn <b>+ Phân công Staff</b> để giao Staff cho facility.</div>`}</div>` }
function renderFacilities() { return `<div class="panel"><div class="panel-head"><h3>Facilities</h3></div><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Address</th><th>Vị trí</th><th>Units</th><th>Status</th></tr></thead><tbody>${state.facilities.map(f => `<tr><td>${f.id}</td><td><strong>${esc(f.name)}</strong></td><td>${esc(f.address)}</td><td>${(f.locations || []).map(esc).join(', ')}</td><td>${state.units.filter(u => u.facility === f.id).length}</td><td>${badge(f.status)}</td></tr>`).join('')}</tbody></table></div>` }
function renderPolicies() { return `<div class="panel"><div class="panel-head"><h3>Current Policies</h3></div><table class="table"><tbody><tr><td>Deposit</td><td>${state.policies.depositMonths} month(s)</td></tr><tr><td>Cancellation notice</td><td>${state.policies.cancellationHours} hours</td></tr><tr><td>Overdue fee</td><td>${money(state.policies.overdueDaily)}/day</td></tr><tr><td>Renewal fee</td><td>${money(state.policies.renewalFee)}</td></tr><tr><td>Damage deposit hold</td><td>${state.policies.damageDepositHold ? 'Yes' : 'No'}</td></tr><tr><td>Fee waiver</td><td>${state.policies.feeWaiverEnabled ? 'Enabled' : 'Disabled'} · max ${state.policies.feeWaiverMaxPercent}%</td></tr></tbody></table></div>` }
function renderFees() { return `<div class="panel"><div class="panel-head"><h3>Fee Schedule</h3></div><table class="table"><tbody><tr><td>Discount</td><td>${state.fees.discountPercent}%</td></tr><tr><td>Extra access card</td><td>${money(state.fees.extraAccessCard)}</td></tr><tr><td>Lock replacement</td><td>${money(state.fees.lockReplacement)}</td></tr><tr><td>Repair minimum</td><td>${money(state.fees.repairMinimum)}</td></tr></tbody></table></div>` }
function renderRevenue() { const payments = (state.payments || []).filter(p => p.status === 'Success' && ['rent', 'cycle', 'renewal', 'repair', 'extra'].includes(p.kind)); const scoped = roleIs('Facility Manager') ? payments.filter(p => { const ctx = activityContext(JSON.stringify(p)); if (ctx.facilityId) return hasFacilityAccess(ctx.facilityId); if (p.bookingId) return hasFacilityAccess(getBooking(p.bookingId)?.facility); if (p.contractId) return hasFacilityAccess(getUnit(getContract(p.contractId)?.unitId)?.facility); return false }) : payments; const revenue = scoped.filter(p => p.kind !== 'deposit').reduce((s, p) => s + Number(p.amount || 0), 0); const units = roleIs('Facility Manager') ? facilityScopedUnits() : state.units; const contracts = roleIs('Facility Manager') ? state.contracts.filter(c => hasFacilityAccess(getUnit(c.unitId)?.facility)) : state.contracts; return `<div class="stats">${stat('Revenue', money(revenue), roleIs('Facility Manager') ? 'Trong facility được phân quyền' : 'Toàn hệ thống', 'up')}${stat('Deposit held', money((state.payments || []).filter(p => p.status === 'Success' && p.kind === 'deposit' && contracts.some(c => c.bookingId === p.bookingId && ['Active', 'Return Requested', 'Damage Review'].includes(c.status))).reduce((s, p) => s + Number(p.amount || 0), 0)), 'Không tính vào revenue', '')}${stat('Active contracts', contracts.filter(c => c.status === 'Active').length, 'Current', 'up')}${stat('Utilization', Math.round(units.filter(u => u.status === 'Rented').length / Math.max(1, units.filter(u => u.status !== 'Maintenance').length) * 100) + '%', `${units.filter(u => u.status === 'Rented').length}/${units.filter(u => u.status !== 'Maintenance').length} rentable`, 'up')}</div><div class="panel"><div class="panel-head"><h3>${roleIs('Facility Manager') ? 'Revenue của facility được phân quyền' : 'Revenue toàn hệ thống'}</h3></div>${scoped.length ? `<table class="table"><thead><tr><th>Payment</th><th>Kind</th><th>Customer</th><th>Amount</th><th>Code</th></tr></thead><tbody>${scoped.map(p => `<tr><td>${p.id}</td><td>${p.kind}</td><td>${esc(p.customer)}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.paymentCode || '—')}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">Chưa có doanh thu trong phạm vi được phép.</div>`}</div>` }
function renderOperationsReports() { return `<div class="grid-2">${panel('Facility utilization', operationsTable())}${panel('Latest activity', activityHTML())}</div><div class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>System-wide report</h3><p class="muted">Xuất dữ liệu theo facility, unit, trạng thái, kỳ thuê và khoản thu.</p></div><button class="mini-btn" onclick="exportReport()">Export CSV</button></div></div>` }
function exportReport() { if (!roleIs('Business Operations Manager')) return showToast('Chỉ Business Operations Manager xuất báo cáo.'); const rows = [['Facility', 'Unit', 'Location', 'Type', 'Size', 'Status', 'Customer', 'Start', 'End', 'Revenue']]; state.units.forEach(u => { const c = state.contracts.find(c => c.unitId === u.id && c.status !== 'Completed'); const rev = c ? state.payments.filter(p => p.status === 'Success' && (p.bookingId === c.bookingId || p.contractId === c.id) && ['rent', 'cycle', 'renewal', 'repair', 'extra'].includes(p.kind)).reduce((s, p) => s + p.amount, 0) : 0; rows.push([getFacility(u.facility)?.name || u.facility, u.id, u.location || '', u.type, u.size, u.status, c?.customer || '', c?.start || '', c?.end || '', rev]) }); const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `storespace-report-${localDateInputValue()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); showToast('Đã xuất báo cáo CSV.'); }

function openModal(title, body) { let m = $('appModal'); if (!m) { m = document.createElement('div'); m.id = 'appModal'; m.className = 'modal-backdrop'; document.body.appendChild(m) } m.innerHTML = `<div class="modal-card"><div class="modal-head"><h2>${title}</h2><button onclick="closeModal()">×</button></div><div class="modal-body">${body}</div></div>`; m.classList.add('show') }
function closeModal() { const m = $('appModal'); if (m) m.classList.remove('show') }

loadAccounts(); normalizeAccounts(); loadState(); normalizeState();
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('email').value.trim().toLowerCase(), password = $('password').value;

  try {
    const res = await fetch('http://localhost:5046/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      $('loginError').textContent = data.message || 'Lỗi đăng nhập';
      return;
    }
    const userData = await res.json();
    $('loginError').textContent = '';

    // Tạm thời chuyển format API về format Frontend cũ để tương thích với các logic demo còn lại
    const initials = userData.fullName.split(/\s+/).filter(Boolean).slice(-2).map(x => x[0]).join('').toUpperCase() || 'U';
    currentUser = {
      email: userData.email,
      name: userData.fullName,
      role: userData.roleName,
      initials: initials,
      permissions: accountPermissionsForRole(userData.roleName),
      status: userData.status,
      facilityIds: (userData.roleName === 'Business Operations Manager' || userData.roleName === 'System Administrator') ? ['*'] : ['F01']
    };

    closeLoginModal();
    $('landingPage').classList.add('hidden');
    $('appPage').classList.remove('hidden');
    $('userName').textContent = currentUser.name;
    $('userRole').textContent = currentUser.role;
    $('userAvatar').textContent = currentUser.initials;
    buildNav(); renderPage('dashboard');
    showToast('Đăng nhập thành công từ Backend API.');
  } catch (error) {
    $('loginError').textContent = 'Lỗi kết nối Backend. Hãy chắc chắn Backend đang chạy.';
  }
});
document.querySelectorAll('[data-login]').forEach(btn => btn.addEventListener('click', () => login(btn.dataset.login)));
$('openRegister')?.addEventListener('click', openRegisterModal); $('closeRegister')?.addEventListener('click', closeRegisterModal); $('cancelRegister')?.addEventListener('click', closeRegisterModal); $('registerForm')?.addEventListener('submit', registerCustomer); $('registerModal')?.addEventListener('click', e => { if (e.target.id === 'registerModal') closeRegisterModal() });
$('togglePassword').onclick = () => { const p = $('password'); p.type = p.type === 'password' ? 'text' : 'password'; $('togglePassword').textContent = p.type === 'password' ? 'Hiện' : 'Ẩn' };
$('logoutBtn').onclick = () => { localStorage.removeItem('storespace_user'); currentUser = null; $('appPage').classList.add('hidden'); $('landingPage').classList.remove('hidden'); $('loginPage').classList.remove('show'); $('loginPage').classList.add('hidden'); $('email').value = ''; $('password').value = ''; $('loginError').textContent = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); renderPublicCatalog(); renderPublicFacilities(); };
$('mobileMenu').onclick = () => $('appPage').querySelector('.sidebar').classList.toggle('open');
$('facilityButton').onclick = () => showToast('Facility switch là demo UI. Các thao tác dữ liệu hiện tác động toàn hệ thống.');
loadState(); normalizeState(); initPublicLanding();
const saved = localStorage.getItem('storespace_user'); if (saved && accounts[saved]) login(saved);
