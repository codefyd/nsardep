// staff.js - Dashboard Logic
const API_BASE = API_URL;
let currentSession = null;
let currentUserRole = '';
let currentUserCircle = '';
let currentTab = 'dashboard';
let studentsData = [];

function showLoader(show) {
  const loader = document.getElementById('globalLoader');
  if (loader) {
    if (show) loader.classList.remove('d-none');
    else loader.classList.add('d-none');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function formatDate(dateStr, hijri = false) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (hijri) {
      // Simple conversion - can be improved with a proper library
      return date.toLocaleDateString('ar-SA-u-ca-islamic');
    }
    return date.toLocaleDateString('ar-SA');
  } catch(e) { return dateStr; }
}

function openWhatsApp(phone, text = '') {
  if (!phone) return '#';
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '#';
  const link = `https://wa.me/966${cleaned.replace(/^0/, '')}?text=${encodeURIComponent(text)}`;
  window.open(link, '_blank');
}

async function apiCall(action, data = {}, withAuth = true) {
  const params = new URLSearchParams();
  params.append('action', action);
  if (withAuth && currentSession?.token) {
    params.append('token', currentSession.token);
  }
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
  });

  const response = await fetch(API_BASE, { method: 'POST', body: params });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'حدث خطأ');
  return result.data;
}

async function loadDashboard() {
  showLoader(true);
  try {
    const data = await apiCall('getDashboardData');
    renderStatsCards(data.stats);
    renderRecentActivities(data.recentActivities);
    studentsData = data.students || [];
    return data;
  } catch (err) {
    Swal.fire('خطأ', err.message, 'error');
    return null;
  } finally {
    showLoader(false);
  }
}

function renderStatsCards(stats) {
  const container = document.getElementById('statsCards');
  const cards = [
    { label: 'إجمالي الطلاب', value: stats.totalStudents || 0, icon: 'fa-users', color: 'success' },
    { label: 'عدد الحلق', value: stats.totalCircles || 0, icon: 'fa-layer-group', color: 'primary' },
    { label: 'الطلبات الجديدة', value: stats.newRequests || 0, icon: 'fa-inbox', color: 'warning' },
    { label: 'إنذارات مفتوحة', value: stats.openWarnings || 0, icon: 'fa-bell', color: 'danger' }
  ];
  
  container.innerHTML = cards.map(card => `
    <div class="col-md-3 col-sm-6">
      <div class="kpi-card">
        <div class="bg-icon-float"><i class="fa-solid ${card.icon}"></i></div>
        <div class="kpi-label">${card.label}</div>
        <div class="kpi-value">${card.value}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentActivities(activities) {
  const container = document.getElementById('recentActivities');
  if (!activities || activities.length === 0) {
    container.innerHTML = '<div class="card-body text-muted text-center">لا توجد أنشطة حديثة</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="card-header bg-white fw-bold">
      <i class="fa-solid fa-clock ms-2"></i>آخر النشاطات
    </div>
    <div class="list-group list-group-flush">
      ${activities.map(act => `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <i class="fa-solid fa-${act.icon || 'circle-info'} ms-2 text-${act.type === 'warning' ? 'warning' : 'success'}"></i>
              <span>${escapeHtml(act.description)}</span>
            </div>
            <small class="text-muted">${formatDate(act.date)}</small>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderStudentsTable() {
  const container = document.getElementById('studentsTab');
  const canEdit = ['مدير', 'مشرف إداري'].includes(currentUserRole);
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 class="mb-0 fw-bold"><i class="fa-solid fa-users ms-2"></i>إدارة الطلاب</h5>
        <div class="d-flex gap-2">
          ${canEdit ? `<button class="btn btn-success btn-sm" id="addStudentBtn"><i class="fa-solid fa-plus ms-1"></i>إضافة طالب</button>` : ''}
          ${canEdit ? `<button class="btn btn-outline-primary btn-sm" id="bulkEditBtn"><i class="fa-solid fa-pen ms-1"></i>تعديل جماعي</button>` : ''}
          <button class="btn btn-outline-secondary btn-sm" id="exportCSVBtn"><i class="fa-solid fa-file-csv ms-1"></i>CSV</button>
          <button class="btn btn-outline-secondary btn-sm" id="exportExcelBtn"><i class="fa-solid fa-file-excel ms-1"></i>Excel</button>
        </div>
      </div>
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-3">
            <select id="filterCircle" class="form-select"><option value="">كل الحلق</option></select>
          </div>
          <div class="col-md-3">
            <select id="filterStatus" class="form-select"><option value="">كل الحالات</option></select>
          </div>
          <div class="col-md-3">
            <select id="filterMemorization" class="form-select">
              <option value="">كل مجموع الحفظ</option>
              <option value="lt5">أقل من 5 أجزاء</option>
              <option value="5-10">5-10 أجزاء</option>
              <option value="gt10">أكثر من 10 أجزاء</option>
            </select>
          </div>
          <div class="col-md-3">
            <input type="text" id="searchStudent" class="form-control" placeholder="بحث بالاسم أو الهوية...">
          </div>
        </div>
        <div class="table-responsive">
          <table id="studentsTable" class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th><input type="checkbox" id="selectAll"></th>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الحلقة</th>
                <th>مجموع الحفظ</th>
                <th>حالة الطالب</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody id="studentsTableBody"></tbody>
          </table>
        </div>
        <nav aria-label="Page navigation" class="mt-3">
          <ul class="pagination justify-content-center" id="pagination"></ul>
        </nav>
      </div>
    </div>
  `;
  
  await loadCirclesAndStatuses();
  renderFilteredStudents();
  
  document.getElementById('filterCircle')?.addEventListener('change', () => renderFilteredStudents());
  document.getElementById('filterStatus')?.addEventListener('change', () => renderFilteredStudents());
  document.getElementById('filterMemorization')?.addEventListener('change', () => renderFilteredStudents());
  document.getElementById('searchStudent')?.addEventListener('input', () => renderFilteredStudents());
  document.getElementById('selectAll')?.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
  
  if (canEdit) {
    document.getElementById('addStudentBtn')?.addEventListener('click', showAddStudentModal);
    document.getElementById('bulkEditBtn')?.addEventListener('click', showBulkEditModal);
  }
  document.getElementById('exportCSVBtn')?.addEventListener('click', () => exportData('csv'));
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportData('excel'));
}

let currentPage = 1;
const itemsPerPage = 50;
let filteredStudents = [];

function renderFilteredStudents() {
  const circle = document.getElementById('filterCircle')?.value;
  const status = document.getElementById('filterStatus')?.value;
  const memorization = document.getElementById('filterMemorization')?.value;
  const search = document.getElementById('searchStudent')?.value.toLowerCase();
  
  filteredStudents = studentsData.filter(s => {
    if (currentUserRole === 'معلم' && s.circleName !== currentUserCircle) return false;
    if (circle && s.circleName !== circle) return false;
    if (status && s.studentStatus !== status) return false;
    if (memorization) {
      const total = parseInt(s.totalMemorized) || 0;
      if (memorization === 'lt5' && total >= 5) return false;
      if (memorization === '5-10' && (total < 5 || total > 10)) return false;
      if (memorization === 'gt10' && total <= 10) return false;
    }
    if (search) {
      return s.studentName?.toLowerCase().includes(search) || 
             s.studentId?.includes(search);
    }
    return true;
  });
  
  currentPage = 1;
  renderStudentsPage();
}

function renderStudentsPage() {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageStudents = filteredStudents.slice(start, end);
  const tbody = document.getElementById('studentsTableBody');
  
  tbody.innerHTML = pageStudents.map(s => `
    <tr>
      <td><input type="checkbox" class="student-select" data-id="${s.studentId}"></td>
      <td><a href="#" class="student-link text-decoration-none fw-bold" data-id="${s.studentId}">${escapeHtml(s.studentName)}</a></td>
      <td>${escapeHtml(s.studentId)}</td>
      <td>${escapeHtml(s.circleName || '-')}</td>
      <td>${escapeHtml(s.totalMemorized || '0')} جزء</td>
      <td><span class="badge bg-${s.studentStatus === 'منتظم' ? 'success' : 'secondary'}">${escapeHtml(s.studentStatus || 'مستجد')}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-student" data-id="${s.studentId}"><i class="fa-solid fa-eye"></i></button>
        ${['مدير', 'مشرف إداري'].includes(currentUserRole) ? `
          <button class="btn btn-sm btn-outline-warning edit-student" data-id="${s.studentId}"><i class="fa-solid fa-pen"></i></button>
        ` : ''}
        ${currentUserRole === 'معلم' ? `
          <button class="btn btn-sm btn-outline-info add-note" data-id="${s.studentId}"><i class="fa-solid fa-pen"></i>ملاحظة</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
  
  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const pagination = document.getElementById('pagination');
  let paginationHtml = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
  }
  pagination.innerHTML = paginationHtml;
  
  document.querySelectorAll('.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentPage = parseInt(link.dataset.page);
      renderStudentsPage();
    });
  });
  
  document.querySelectorAll('.student-link, .view-student').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showStudentDetails(el.dataset.id);
    });
  });
  
  document.querySelectorAll('.edit-student').forEach(btn => {
    btn.addEventListener('click', () => showEditStudentModal(btn.dataset.id));
  });
  
  document.querySelectorAll('.add-note').forEach(btn => {
    btn.addEventListener('click', () => showAddNoteModal(btn.dataset.id));
  });
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.student-select').forEach(cb => cb.checked = checked);
}

async function loadCirclesAndStatuses() {
  try {
    const settings = await apiCall('getSettings');
    const circles = settings.circles || [];
    const statuses = settings.studentStatuses || [];
    
    const circleSelect = document.getElementById('filterCircle');
    if (circleSelect) {
      circles.forEach(c => {
        circleSelect.innerHTML += `<option value="${c}">${c}</option>`;
      });
    }
    
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) {
      statuses.forEach(s => {
        statusSelect.innerHTML += `<option value="${s}">${s}</option>`;
      });
    }
  } catch(e) { console.error(e); }
}

async function showStudentDetails(studentId) {
  const student = studentsData.find(s => s.studentId === studentId);
  if (!student) return;
  
  Swal.fire({
    title: student.studentName,
    html: `
      <div class="text-start">
        <div class="row g-2">
          <div class="col-6"><strong>رقم الهوية:</strong> ${escapeHtml(student.studentId)}</div>
          <div class="col-6"><strong>رقم الجوال:</strong> ${escapeHtml(student.studentPhone)}</div>
          <div class="col-6"><strong>العنوان:</strong> ${escapeHtml(student.address || '-')}</div>
          <div class="col-6"><strong>المرحلة:</strong> ${escapeHtml(student.educationLevel || '-')}</div>
          <div class="col-6"><strong>الصف:</strong> ${escapeHtml(student.educationGrade || '-')}</div>
          <div class="col-6"><strong>الحلقة:</strong> ${escapeHtml(student.circleName || '-')}</div>
          <div class="col-6"><strong>مجموع الحفظ:</strong> ${escapeHtml(student.totalMemorized || '0')} جزء</div>
          <div class="col-6"><strong>حالة الطالب:</strong> ${escapeHtml(student.studentStatus || 'مستجد')}</div>
          <div class="col-12"><hr><strong>ولي الأمر:</strong></div>
          <div class="col-6"><strong>الاسم:</strong> ${escapeHtml(student.guardianName)}</div>
          <div class="col-6"><strong>الجوال:</strong> <a href="#" onclick="openWhatsApp('${student.guardianPhone}')">${escapeHtml(student.guardianPhone)}</a></div>
          <div class="col-6"><strong>الهوية:</strong> ${escapeHtml(student.guardianId)}</div>
          <div class="col-6"><strong>الصلة:</strong> ${escapeHtml(student.guardianRelation)}</div>
        </div>
      </div>
    `,
    width: 600,
    confirmButtonText: 'إغلاق',
    showCancelButton: ['مدير', 'مشرف إداري'].includes(currentUserRole),
    cancelButtonText: 'تعديل',
    cancelButtonColor: '#28a745'
  }).then(result => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      showEditStudentModal(studentId);
    }
  });
}

function showEditStudentModal(studentId) {
  const student = studentsData.find(s => s.studentId === studentId);
  if (!student) return;
  
  const modal = new bootstrap.Modal(document.getElementById('studentEditModal'));
  const formContainer = document.getElementById('studentEditForm');
  
  formContainer.innerHTML = `
    <form id="editStudentForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">اسم الطالب</label>
          <input type="text" name="studentName" class="form-control" value="${escapeHtml(student.studentName)}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">رقم الهوية</label>
          <input type="text" name="studentId" class="form-control" value="${escapeHtml(student.studentId)}" readonly>
        </div>
        <div class="col-md-6">
          <label class="form-label">رقم الجوال</label>
          <input type="tel" name="studentPhone" class="form-control" value="${escapeHtml(student.studentPhone)}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">العنوان</label>
          <input type="text" name="address" class="form-control" value="${escapeHtml(student.address || '')}">
        </div>
        <div class="col-md-6">
          <label class="form-label">المرحلة الدراسية</label>
          <input type="text" name="educationLevel" class="form-control" value="${escapeHtml(student.educationLevel || '')}">
        </div>
        <div class="col-md-6">
          <label class="form-label">الصف الدراسي</label>
          <input type="text" name="educationGrade" class="form-control" value="${escapeHtml(student.educationGrade || '')}">
        </div>
        <div class="col-md-6">
          <label class="form-label">الحلقة</label>
          <select name="circleName" class="form-select" id="editCircleSelect"></select>
        </div>
        <div class="col-md-6">
          <label class="form-label">مجموع الحفظ (أجزاء)</label>
          <input type="number" name="totalMemorized" class="form-control" value="${student.totalMemorized || 0}">
        </div>
        <div class="col-md-6">
          <label class="form-label">حالة الطالب</label>
          <select name="studentStatus" class="form-select" id="editStatusSelect"></select>
        </div>
        <div class="col-md-6">
          <label class="form-label">اسم ولي الأمر</label>
          <input type="text" name="guardianName" class="form-control" value="${escapeHtml(student.guardianName)}">
        </div>
        <div class="col-md-6">
          <label class="form-label">جوال ولي الأمر</label>
          <input type="tel" name="guardianPhone" class="form-control" value="${escapeHtml(student.guardianPhone)}">
        </div>
        <div class="col-md-6">
          <label class="form-label">هوية ولي الأمر</label>
          <input type="text" name="guardianId" class="form-control" value="${escapeHtml(student.guardianId)}">
        </div>
        <div class="col-md-6">
          <label class="form-label">صلة ولي الأمر</label>
          <input type="text" name="guardianRelation" class="form-control" value="${escapeHtml(student.guardianRelation)}">
        </div>
      </div>
      <div class="mt-4">
        <button type="submit" class="btn btn-success w-100">حفظ التغييرات</button>
      </div>
    </form>
  `;
  
  modal.show();
  
  // Load circles and statuses for selects
  (async () => {
    const settings = await apiCall('getSettings');
    const circles = settings.circles || [];
    const statuses = settings.studentStatuses || [];
    
    const circleSelect = document.getElementById('editCircleSelect');
    const statusSelect = document.getElementById('editStatusSelect');
    
    circles.forEach(c => {
      circleSelect.innerHTML += `<option value="${c}" ${student.circleName === c ? 'selected' : ''}>${c}</option>`;
    });
    statuses.forEach(s => {
      statusSelect.innerHTML += `<option value="${s}" ${student.studentStatus === s ? 'selected' : ''}>${s}</option>`;
    });
  })();
  
  document.getElementById('editStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    showLoader(true);
    try {
      await apiCall('updateStudent', { studentId, data });
      Swal.fire('تم التحديث', 'تم حفظ بيانات الطالب بنجاح', 'success');
      modal.hide();
      await loadDashboard();
      await renderStudentsTable();
    } catch (err) {
      Swal.fire('خطأ', err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
}

function showAddNoteModal(studentId) {
  Swal.fire({
    title: 'إضافة ملاحظة للطالب',
    input: 'textarea',
    inputPlaceholder: 'اكتب ملاحظتك هنا...',
    inputAttributes: { rows: 4 },
    confirmButtonText: 'حفظ الملاحظة',
    cancelButtonText: 'إلغاء',
    showCancelButton: true
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      showLoader(true);
      try {
        await apiCall('addTeacherNote', { studentId, note: result.value });
        Swal.fire('تم الحفظ', 'تمت إضافة الملاحظة بنجاح', 'success');
      } catch (err) {
        Swal.fire('خطأ', err.message, 'error');
      } finally {
        showLoader(false);
      }
    }
  });
}

function showAddStudentModal() {
  Swal.fire({
    title: 'إضافة طالب جديد',
    html: `
      <div class="text-start">
        <div class="mb-3"><label class="form-label">اسم الطالب ثلاثي</label><input id="newName" class="swal2-input" required></div>
        <div class="mb-3"><label class="form-label">هوية الطالب</label><input id="newId" class="swal2-input" pattern="\\d{8,12}" required></div>
        <div class="mb-3"><label class="form-label">رقم الجوال</label><input id="newPhone" class="swal2-input" pattern="\\d{10}" required></div>
        <div class="mb-3"><label class="form-label">الحلقة</label><select id="newCircle" class="swal2-select"></select></div>
        <div class="mb-3"><label class="form-label">اسم ولي الأمر</label><input id="newGuardianName" class="swal2-input"></div>
        <div class="mb-3"><label class="form-label">جوال ولي الأمر</label><input id="newGuardianPhone" class="swal2-input" pattern="\\d{10}"></div>
      </div>
    `,
    confirmButtonText: 'إضافة',
    cancelButtonText: 'إلغاء',
    showCancelButton: true,
    preConfirm: async () => {
      const settings = await apiCall('getSettings');
      const circles = settings.circles || [];
      const circleSelect = document.getElementById('newCircle');
      circles.forEach(c => circleSelect.innerHTML += `<option value="${c}">${c}</option>`);
      
      return {
        studentName: document.getElementById('newName').value,
        studentId: document.getElementById('newId').value,
        studentPhone: document.getElementById('newPhone').value,
        circleName: document.getElementById('newCircle').value,
        guardianName: document.getElementById('newGuardianName').value,
        guardianPhone: document.getElementById('newGuardianPhone').value
      };
    }
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      showLoader(true);
      try {
        await apiCall('addStudent', result.value);
        Swal.fire('تم الإضافة', 'تمت إضافة الطالب بنجاح', 'success');
        await loadDashboard();
        await renderStudentsTable();
      } catch (err) {
        Swal.fire('خطأ', err.message, 'error');
      } finally {
        showLoader(false);
      }
    }
  });
}

function showBulkEditModal() {
  const selected = Array.from(document.querySelectorAll('.student-select:checked')).map(cb => cb.dataset.id);
  if (selected.length === 0) {
    Swal.fire('تنبيه', 'يرجى اختيار طالب واحد على الأقل', 'warning');
    return;
  }
  
  Swal.fire({
    title: `تعديل جماعي (${selected.length} طالب)`,
    html: `
      <div class="text-start">
        <div class="mb-3"><label class="form-label">تغيير الحلقة إلى</label><select id="bulkCircle" class="swal2-select"><option value="">بدون تغيير</option></select></div>
        <div class="mb-3"><label class="form-label">تغيير حالة الطالب إلى</label><select id="bulkStatus" class="swal2-select"><option value="">بدون تغيير</option></select></div>
        <div class="mb-3"><label class="form-label">إضافة لمجموع الحفظ</label><input id="bulkAddMem" type="number" class="swal2-input" placeholder="0" value="0"></div>
      </div>
    `,
    confirmButtonText: 'تطبيق التغييرات',
    cancelButtonText: 'إلغاء',
    showCancelButton: true,
    preConfirm: async () => {
      const settings = await apiCall('getSettings');
      const circles = settings.circles || [];
      const statuses = settings.studentStatuses || [];
      const circleSelect = document.getElementById('bulkCircle');
      const statusSelect = document.getElementById('bulkStatus');
      
      circles.forEach(c => circleSelect.innerHTML += `<option value="${c}">${c}</option>`);
      statuses.forEach(s => statusSelect.innerHTML += `<option value="${s}">${s}</option>`);
      
      return {
        studentIds: selected,
        circle: document.getElementById('bulkCircle').value,
        status: document.getElementById('bulkStatus').value,
        addMemorization: parseInt(document.getElementById('bulkAddMem').value) || 0
      };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      showLoader(true);
      try {
        await apiCall('bulkUpdateStudents', result.value);
        Swal.fire('تم التحديث', 'تم تحديث بيانات الطلاب بنجاح', 'success');
        await loadDashboard();
        await renderStudentsTable();
      } catch (err) {
        Swal.fire('خطأ', err.message, 'error');
      } finally {
        showLoader(false);
      }
    }
  });
}

function exportData(type) {
  const exportData = filteredStudents.map(s => ({
    'اسم الطالب': s.studentName,
    'رقم الهوية': s.studentId,
    'رقم الجوال': s.studentPhone,
    'الحلقة': s.circleName,
    'مجموع الحفظ': s.totalMemorized,
    'حالة الطالب': s.studentStatus,
    'ولي الأمر': s.guardianName,
    'جوال ولي الأمر': s.guardianPhone
  }));
  
  const headers = Object.keys(exportData[0] || {});
  const csvRows = [headers.join(',')];
  exportData.forEach(row => {
    const values = headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`);
    csvRows.push(values.join(','));
  });
  const csv = csvRows.join('\n');
  
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', `students_export_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function renderRequestsTab() {
  const container = document.getElementById('requestsTab');
  const requests = await apiCall('getRequests');
  
  const sections = [
    { title: 'طلبات التسجيل الجديدة', type: 'new', requests: requests.new },
    { title: 'طلبات الانتظار', type: 'pending', requests: requests.pending },
    { title: 'الطلبات المرفوضة', type: 'rejected', requests: requests.rejected },
    { title: 'طلبات تعديل البيانات', type: 'modify', requests: requests.modify }
  ];
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white fw-bold"><i class="fa-solid fa-inbox ms-2"></i>الطلبات الواردة</div>
      <div class="card-body">
        ${sections.map(section => `
          <h6 class="mt-3 mb-2">${section.title}</h6>
          <div class="table-responsive mb-4">
            <table class="table table-sm table-hover">
              <thead class="table-light">
                <tr><th>اسم الطالب</th><th>الهوية</th><th>رقم ولي الأمر</th><th>المرحلة/الصف</th><th>الحالة</th><th>الإجراءات</th></tr>
              </thead>
              <tbody>
                ${section.requests.map(req => `
                  <tr>
                    <td>${escapeHtml(req.studentName)}</td>
                    <td><a href="#" onclick="openWhatsApp('${req.studentPhone}')">${escapeHtml(req.studentId)}</a></td>
                    <td><a href="#" onclick="openWhatsApp('${req.guardianPhone}')">${escapeHtml(req.guardianPhone)}</a></td>
                    <td>${escapeHtml(req.educationLevel || '-')} / ${escapeHtml(req.educationGrade || '-')}</td>
                    <td><span class="badge bg-${req.status === 'مقبول' ? 'success' : req.status === 'مرفوض' ? 'danger' : 'warning'}">${escapeHtml(req.status)}</span></td>
                    <td>${section.type !== 'rejected' ? `
                      <button class="btn btn-sm btn-success req-action" data-id="${req.id}" data-action="approve">قبول</button>
                      <button class="btn btn-sm btn-warning req-action" data-id="${req.id}" data-action="pending">انتظار</button>
                      <button class="btn btn-sm btn-danger req-action" data-id="${req.id}" data-action="reject">رفض</button>
                    ` : `<small class="text-muted">سبب الرفض: ${escapeHtml(req.rejectionReason || '-')}</small>`}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6" class="text-center text-muted">لا توجد طلبات</td></tr>'}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.querySelectorAll('.req-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      
      let extraData = {};
      if (action === 'approve') {
        const { value: circle } = await Swal.fire({
          title: 'تسكين الطالب في حلقة',
          input: 'select',
          inputOptions: await getCirclesOptions(),
          inputPlaceholder: 'اختر الحلقة',
          confirmButtonText: 'اعتماد'
        });
        if (!circle) return;
        extraData.circle = circle;
      }
      
      if (action === 'reject') {
        const { value: reason } = await Swal.fire({
          title: 'سبب الرفض',
          input: 'textarea',
          inputPlaceholder: 'أدخل سبب الرفض',
          confirmButtonText: 'رفض'
        });
        if (!reason) return;
        extraData.reason = reason;
      }
      
      showLoader(true);
      try {
        await apiCall('processRequest', { requestId: id, action, ...extraData });
        Swal.fire('تم', `تم ${action === 'approve' ? 'قبول' : action === 'reject' ? 'رفض' : 'نقل للانتظار'} الطلب`, 'success');
        await renderRequestsTab();
        await loadDashboard();
      } catch (err) {
        Swal.fire('خطأ', err.message, 'error');
      } finally {
        showLoader(false);
      }
    });
  });
}

async function getCirclesOptions() {
  const settings = await apiCall('getSettings');
  const circles = settings.circles || [];
  const options = {};
  circles.forEach(c => options[c] = c);
  return options;
}

async function renderEducationalWarningsTab() {
  const container = document.getElementById('educationalWarningsTab');
  const warnings = await apiCall('getEducationalWarnings');
  const settings = await apiCall('getSettings');
  const educationalActions = settings.educationalActions || [];
  
  const canAdd = ['مدير', 'مشرف إداري', 'مشرف تعليمي'].includes(currentUserRole);
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white d-flex justify-content-between align-items-center">
        <h5 class="mb-0 fw-bold"><i class="fa-solid fa-bell ms-2"></i>الإنذارات التعليمية</h5>
        ${canAdd ? `<button class="btn btn-warning btn-sm" id="addWarningBtn"><i class="fa-solid fa-plus ms-1"></i>إضافة إنذار</button>` : ''}
      </div>
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-4"><select id="filterWarningCircle" class="form-select"><option value="">كل الحلق</option></select></div>
          <div class="col-md-4"><select id="filterWarningAction" class="form-select"><option value="">كل الإجراءات</option></select></div>
          <div class="col-md-4"><input type="text" id="searchWarning" class="form-control" placeholder="بحث باسم الطالب..."></div>
        </div>
        <div class="table-responsive">
          <table class="table table-hover">
            <thead class="table-light">
              <tr><th>اسم الطالب</th><th>الحلقة</th><th>سبب الإنذار</th><th>الإجراء الحالي</th><th>التاريخ</th><th>الإجراءات</th></tr>
            </thead>
            <tbody id="warningsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  const warningCircles = [...new Set(warnings.map(w => w.circleName).filter(Boolean))];
  const circleSelect = document.getElementById('filterWarningCircle');
  warningCircles.forEach(c => circleSelect.innerHTML += `<option value="${c}">${c}</option>`);
  
  educationalActions.forEach(a => {
    document.getElementById('filterWarningAction').innerHTML += `<option value="${a}">${a}</option>`;
  });
  
  function renderWarningsTable() {
    const circle = document.getElementById('filterWarningCircle').value;
    const action = document.getElementById('filterWarningAction').value;
    const search = document.getElementById('searchWarning').value.toLowerCase();
    
    let filtered = warnings;
    if (circle) filtered = filtered.filter(w => w.circleName === circle);
    if (action) filtered = filtered.filter(w => w.currentAction === action);
    if (search) filtered = filtered.filter(w => w.studentName?.toLowerCase().includes(search));
    
    const tbody = document.getElementById('warningsTableBody');
    tbody.innerHTML = filtered.map(w => `
      <tr>
        <td>${escapeHtml(w.studentName)}</td>
        <td>${escapeHtml(w.circleName || '-')}</td>
        <td>${escapeHtml(w.reason)}</td>
        <td><span class="badge bg-info">${escapeHtml(w.currentAction)}</span></td>
        <td>${formatDate(w.date)}</td>
        <td>
          <button class="btn btn-sm btn-success contact-student" data-phone="${w.studentPhone}" data-name="${w.studentName}" data-reason="${w.reason}"><i class="fab fa-whatsapp"></i> طالب</button>
          <button class="btn btn-sm btn-primary contact-guardian" data-phone="${w.guardianPhone}" data-name="${w.studentName}" data-reason="${w.reason}"><i class="fab fa-whatsapp"></i> ولي أمر</button>
          ${['مدير', 'مشرف إداري'].includes(currentUserRole) ? `
            <button class="btn btn-sm btn-warning update-action" data-id="${w.id}"><i class="fa-solid fa-pen"></i> تحديث</button>
          ` : ''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">لا توجد إنذارات</td></tr>';
    
    document.querySelectorAll('.contact-student').forEach(btn => {
      btn.addEventListener('click', () => {
        const template = settings.messageTemplates?.educationalStudent || 'نفيدكم بوجود إنذار تعليمي للطالب #اسم_الطالب بسبب #السبب';
        const msg = template.replace(/#اسم_الطالب/g, btn.dataset.name).replace(/#السبب/g, btn.dataset.reason);
        openWhatsApp(btn.dataset.phone, msg);
      });
    });
    
    document.querySelectorAll('.contact-guardian').forEach(btn => {
      btn.addEventListener('click', () => {
        const template = settings.messageTemplates?.educationalGuardian || 'ولي أمر الطالب #اسم_الطالب، نفيدكم بوجود إنذار تعليمي بسبب #السبب';
        const msg = template.replace(/#اسم_الطالب/g, btn.dataset.name).replace(/#السبب/g, btn.dataset.reason);
        openWhatsApp(btn.dataset.phone, msg);
      });
    });
  }
  
  document.getElementById('filterWarningCircle')?.addEventListener('change', renderWarningsTable);
  document.getElementById('filterWarningAction')?.addEventListener('change', renderWarningsTable);
  document.getElementById('searchWarning')?.addEventListener('input', renderWarningsTable);
  
  if (canAdd) {
    document.getElementById('addWarningBtn')?.addEventListener('click', () => {
      const modal = new bootstrap.Modal(document.getElementById('addWarningModal'));
      const actionSelect = document.getElementById('warningAction');
      actionSelect.innerHTML = educationalActions.map(a => `<option value="${a}">${a}</option>`).join('');
      modal.show();
    });
    
    document.getElementById('addWarningForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        studentId: document.getElementById('warningStudentId').value,
        reason: document.getElementById('warningReason').value,
        currentAction: document.getElementById('warningAction').value,
        notes: document.getElementById('warningNotes').value
      };
      showLoader(true);
      try {
        await apiCall('addEducationalWarning', data);
        Swal.fire('تم الإضافة', 'تمت إضافة الإنذار التعليمي بنجاح', 'success');
        bootstrap.Modal.getInstance(document.getElementById('addWarningModal')).hide();
        await renderEducationalWarningsTab();
      } catch (err) {
        Swal.fire('خطأ', err.message, 'error');
      } finally {
        showLoader(false);
      }
    });
  }
  
  renderWarningsTable();
}

async function renderAllWarningsTab() {
  const container = document.getElementById('allWarningsTab');
  const allWarnings = await apiCall('getAllWarnings');
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white fw-bold"><i class="fa-solid fa-list ms-2"></i>سجل الإنذارات كاملة</div>
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-4"><select id="allFilterCircle" class="form-select"><option value="">كل الحلق</option></select></div>
          <div class="col-md-4"><input type="text" id="allSearch" class="form-control" placeholder="بحث باسم الطالب..."></div>
        </div>
        <div class="table-responsive">
          <table class="table table-hover">
            <thead class="table-light">
              <tr><th>اسم الطالب</th><th>الحلقة</th><th>إنذارات التأخر</th><th>إنذارات الغياب</th><th>إنذارات الغياب بعذر</th><th>الإنذارات التعليمية</th></tr>
            </thead>
            <tbody id="allWarningsBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  const circles = [...new Set(allWarnings.map(w => w.circleName).filter(Boolean))];
  circles.forEach(c => {
    document.getElementById('allFilterCircle').innerHTML += `<option value="${c}">${c}</option>`;
  });
  
  function renderAllWarningsTable() {
    const circle = document.getElementById('allFilterCircle').value;
    const search = document.getElementById('allSearch').value.toLowerCase();
    
    let filtered = allWarnings;
    if (circle) filtered = filtered.filter(w => w.circleName === circle);
    if (search) filtered = filtered.filter(w => w.studentName?.toLowerCase().includes(search));
    
    const tbody = document.getElementById('allWarningsBody');
    tbody.innerHTML = filtered.map(w => `
      <tr>
        <td>${escapeHtml(w.studentName)}</td>
        <td>${escapeHtml(w.circleName || '-')}</td>
        <td><span class="badge bg-danger">${w.latenessCount || 0}</span></td>
        <td><span class="badge bg-warning">${w.absenceCount || 0}</span></td>
        <td><span class="badge bg-info">${w.excusedCount || 0}</span></td>
        <td><small>${escapeHtml(w.educationalReasons || '-')}</small></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">لا توجد بيانات</td></tr>';
  }
  
  document.getElementById('allFilterCircle')?.addEventListener('change', renderAllWarningsTable);
  document.getElementById('allSearch')?.addEventListener('input', renderAllWarningsTable);
  renderAllWarningsTable();
}

async function renderSettingsTab() {
  const container = document.getElementById('settingsTab');
  const settings = await apiCall('getSettings');
  
  const sections = [
    { title: 'قوالب الإرسال', key: 'messageTemplates', description: 'قوالب رسائل واتساب' },
    { title: 'عتبات الإنذارات الإدارية', key: 'warningThresholds', description: 'تأخر / غياب / غياب بعذر' },
    { title: 'الإجراءات الإدارية والتعليمية', key: 'actions', description: 'قوائم الإجراءات' },
    { title: 'المستخدمون', key: 'users', description: 'إدارة حسابات العاملين' },
    { title: 'أسماء الحلق', key: 'circles', description: 'إدارة الحلق' },
    { title: 'حالات الطالب', key: 'studentStatuses', description: 'قائمة حالات الطلاب' },
    { title: 'القوائم العامة', key: 'generalLists', description: 'مراحل / صفوف / صلات' }
  ];
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white fw-bold"><i class="fa-solid fa-gear ms-2"></i>الإعدادات المركزية</div>
      <div class="card-body">
        <div class="row g-3">
          ${sections.map(section => `
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-body">
                  <h6 class="fw-bold">${section.title}</h6>
                  <p class="small text-muted">${section.description}</p>
                  <pre class="bg-light p-2 rounded small" style="max-height: 200px; overflow: auto;">${escapeHtml(JSON.stringify(settings[section.key] || {}, null, 2))}</pre>
                  <button class="btn btn-sm btn-outline-primary edit-setting mt-2" data-key="${section.key}">تعديل</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.edit-setting').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const currentValue = settings[key] || {};
      
      const { value: newValue } = await Swal.fire({
        title: `تعديل ${key}`,
        input: 'textarea',
        inputValue: JSON.stringify(currentValue, null, 2),
        inputAttributes: { rows: 15, style: 'font-family: monospace;' },
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        showCancelButton: true,
        width: '800px'
      });
      
      if (newValue) {
        try {
          const parsed = JSON.parse(newValue);
          showLoader(true);
          await apiCall('updateSettings', { key, value: parsed });
          Swal.fire('تم الحفظ', 'تم تحديث الإعدادات بنجاح', 'success');
          await renderSettingsTab();
        } catch (err) {
          Swal.fire('خطأ', err.message, 'error');
        } finally {
          showLoader(false);
        }
      }
    });
  });
}

async function renderTeacherNotesTab() {
  const container = document.getElementById('teacherNotesTab');
  const notes = await apiCall('getTeacherNotes');
  
  container.innerHTML = `
    <div class="card shadow-sm rounded-3">
      <div class="card-header bg-white fw-bold"><i class="fa-solid fa-pen ms-2"></i>ملاحظاتي على الطلاب</div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-hover">
            <thead class="table-light">
              <tr><th>اسم الطالب</th><th>الحلقة</th><th>الملاحظة</th><th>التاريخ</th></tr>
            </thead>
            <tbody>
              ${notes.map(n => `
                <tr>
                  <td>${escapeHtml(n.studentName)}</td>
                  <td>${escapeHtml(n.circleName || '-')}</td>
                  <td>${escapeHtml(n.note)}</td>
                  <td>${formatDate(n.date)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-center text-muted">لا توجد ملاحظات</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function switchTab(tab) {
  document.querySelectorAll('.tab-content-area').forEach(t => t.classList.add('d-none'));
  document.querySelectorAll('#sidebarMenu .list-group-item').forEach(item => item.classList.remove('active'));
  
  currentTab = tab;
  document.getElementById(`${tab}Tab`).classList.remove('d-none');
  document.querySelector(`#sidebarMenu [data-tab="${tab}"]`).classList.add('active');
  
  switch(tab) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'students':
      await renderStudentsTable();
      break;
    case 'requests':
      await renderRequestsTab();
      break;
    case 'educational-warnings':
      await renderEducationalWarningsTab();
      break;
    case 'admin-warnings':
      // Admin warnings rendering
      break;
    case 'all-warnings':
      await renderAllWarningsTab();
      break;
    case 'settings':
      if (['مدير', 'مشرف إداري'].includes(currentUserRole)) await renderSettingsTab();
      else Swal.fire('تنبيه', 'لا تملك صلاحية الوصول للإعدادات', 'warning');
      break;
    case 'teacher-notes':
      if (currentUserRole === 'معلم') await renderTeacherNotesTab();
      else Swal.fire('تنبيه', 'هذه الصفحة مخصصة للمعلمين فقط', 'warning');
      break;
  }
}

// Initialize
(async function init() {
  const session = localStorage.getItem('quran_session');
  if (!session) {
    window.location.href = 'staff-login.html';
    return;
  }
  
  currentSession = JSON.parse(session);
  currentUserRole = currentSession.userRole;
  currentUserCircle = currentSession.userCircle || '';
  
  document.getElementById('userRoleBadge').textContent = currentUserRole;
  document.getElementById('userNameDisplay').textContent = currentSession.userName;
  
  // Show/hide tabs based on role
  const requestsTabBtn = document.getElementById('requestsTabBtn');
  const settingsTabBtn = document.getElementById('settingsTabBtn');
  const teacherNotesTabBtn = document.getElementById('teacherNotesTabBtn');
  
  if (currentUserRole === 'معلم') {
    requestsTabBtn?.classList.add('d-none');
    settingsTabBtn?.classList.add('d-none');
  } else if (currentUserRole === 'مشرف تعليمي') {
    requestsTabBtn?.classList.add('d-none');
    settingsTabBtn?.classList.add('d-none');
  } else if (!['مدير', 'مشرف إداري'].includes(currentUserRole)) {
    requestsTabBtn?.classList.add('d-none');
    settingsTabBtn?.classList.add('d-none');
  }
  
  if (currentUserRole !== 'معلم') {
    teacherNotesTabBtn?.classList.add('d-none');
  }
  
  document.querySelectorAll('#sidebarMenu .list-group-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.tab);
    });
  });
  
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('quran_session');
    window.location.href = 'staff-login.html';
  });
  
  await loadDashboard();
})();
