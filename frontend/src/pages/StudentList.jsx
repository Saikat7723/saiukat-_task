import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Eye,
  Edit,
  UserX,
  Trash2,
  CheckCircle2,
  Camera,
  AlertTriangle,
  RefreshCw,
  Users,
  BookOpen
} from 'lucide-react';
import apiClient from '../api/axios';

export const StudentList = () => {
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, library_members: 0 });
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [studentToDeactivate, setStudentToDeactivate] = useState(null);
  const successMsg = location.state?.message || '';

  const fetchStudents = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let url = `/students?page=${page}&limit=${rowsPerPage}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedDept) url += `&department_id=${selectedDept}`;
      if (selectedCourse) url += `&course_id=${selectedCourse}`;
      if (selectedYear) url += `&enrollment_year=${selectedYear}`;
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      
      const res = await apiClient.get(url);
      setStudents(res.data);
      setTotalStudents(Number(res.headers['x-total-count'] || 0));
    } catch (err) {
      setStudents([]);
      setErrorMsg(err.response?.data?.detail || 'Student records could not be loaded. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectoryData = async () => {
    try {
      const [departmentResponse, courseResponse, summaryResponse] = await Promise.all([
        apiClient.get('/admin/departments'),
        apiClient.get('/admin/courses'),
        apiClient.get('/students/summary'),
      ]);
      setDepartments(Array.isArray(departmentResponse.data) ? departmentResponse.data : []);
      setCourses(Array.isArray(courseResponse.data) ? courseResponse.data : []);
      setSummary(summaryResponse.data || { total: 0, active: 0, inactive: 0, library_members: 0 });
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || 'Department filters could not be loaded.');
    }
  };

  useEffect(() => {
    fetchDirectoryData();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [search, selectedDept, selectedCourse, selectedYear, statusFilter, page, rowsPerPage]);

  const filteredStudents = useMemo(() => students, [students]);
  const years = useMemo(() => [...new Set(students.map(student => student.enrollment_year).filter(Boolean))].sort().reverse(), [students]);
  const visibleCourses = courses.filter(course => !selectedDept || String(course.department_id) === String(selectedDept));

  const handleDeactivate = async () => {
    if (!studentToDeactivate) return;
    try {
      await apiClient.delete(`/students/${studentToDeactivate.id}`);
      setStudentToDeactivate(null);
      await Promise.all([fetchStudents(), fetchDirectoryData()]);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Could not deactivate student.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Students</h1>
          <p className="text-sm text-slate-400 mt-1">Manage students, academic records, face profiles and attendance access.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchStudents} disabled={loading} className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50" title="Refresh student records"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <Link to="/admin/students/add" className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition"><UserPlus className="w-4 h-4" /> Add Student</Link>
        </div>
      </div>

      {errorMsg && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" />{errorMsg}</div>}
      {successMsg && <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium" role="status">{successMsg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Users className="w-5 h-5" />} label="Total Students" value={summary.total} tone="blue" />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5" />} label="Active Students" value={summary.active} tone="emerald" />
        <SummaryCard icon={<UserX className="w-5 h-5" />} label="Inactive Students" value={summary.inactive} tone="rose" />
        <SummaryCard icon={<BookOpen className="w-5 h-5" />} label="Library Members" value={summary.library_members} tone="violet" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student by Name, ID, or Email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => { setSelectedDept(e.target.value); setSelectedCourse(''); setPage(1); }}
            className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 flex-1 md:w-48"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); setPage(1); }} className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 flex-1 md:w-44">
            <option value="">All Courses</option>
            {visibleCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>

          <select value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }} className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 flex-1 md:w-28">
            <option value="">All Years</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 flex-1 md:w-36"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Roll / Student ID</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Face Profile</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading student records...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {search || selectedDept || statusFilter ? 'No students match the selected filters.' : 'No students have been registered yet.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-cyan-400 font-bold shrink-0">
                        {student.profile_photo_path ? (
                          <img src={student.profile_photo_path} alt="" className="w-full h-full object-cover" />
                        ) : (
                          student.full_name?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>
                      <div>
                        <Link to={`/admin/students/${student.id}`} className="font-semibold text-slate-100 hover:text-cyan-400 transition">
                          {student.full_name}
                        </Link>
                        <span className="block text-[11px] text-slate-400">{student.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-cyan-400 font-medium">
                      {student.student_id}
                    </td>
                    <td className="px-5 py-3.5">
                      {student.department?.name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {student.phone || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {student.has_face_profile ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">
                          <Camera className="w-3 h-3" /> Pending Photo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/students/${student.id}`}
                          title="View Attendance & Borrowing Profile"
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/admin/students/${student.id}/edit`}
                          title="Edit Student"
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setStudentToDeactivate(student)}
                          title="Delete student permanently"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && totalStudents > 0 && <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, totalStudents)} of {totalStudents} students</span><div className="flex items-center gap-2"><label>Rows per page <select value={rowsPerPage} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(1); }} className="ml-1 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-200"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-700 px-2 py-1 text-slate-300 disabled:opacity-40">Previous</button><span className="rounded-lg bg-blue-600 px-2 py-1 font-semibold text-white">{page}</span><button type="button" onClick={() => setPage(current => current + 1)} disabled={page * rowsPerPage >= totalStudents} className="rounded-lg border border-slate-700 px-2 py-1 text-slate-300 disabled:opacity-40">Next</button></div></div>}
      {studentToDeactivate && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="delete-student-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><span className="rounded-full bg-rose-100 p-3 text-rose-600"><Trash2 className="h-5 w-5" /></span><div><h2 id="delete-student-title" className="text-lg font-bold text-slate-900">Delete Student Permanently?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Delete <strong>{studentToDeactivate.full_name}</strong> and all associated attendance, face profile, and library issue records? This cannot be undone.</p></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setStudentToDeactivate(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={handleDeactivate} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete Permanently</button></div></div></div>}
    </div>
  );
};

const SummaryCard = ({ icon, label, value, tone }) => {
  const tones = {
    blue: 'bg-blue-500/15 text-blue-300', emerald: 'bg-emerald-500/15 text-emerald-300',
    rose: 'bg-rose-500/15 text-rose-300', violet: 'bg-violet-500/15 text-violet-300',
  };
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-center gap-3 shadow-lg"><div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div><div><p className="text-xs text-slate-400">{label}</p><p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p></div></div>;
};
