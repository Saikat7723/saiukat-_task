import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Eye,
  Edit,
  UserX,
  CheckCircle2,
  Camera,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import apiClient from '../api/axios';

export const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let url = '/students?limit=200';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedDept) url += `&department_id=${selectedDept}`;
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      
      const res = await apiClient.get(url);
      setStudents(res.data);
    } catch (err) {
      setStudents([]);
      setErrorMsg(err.response?.data?.detail || 'Student records could not be loaded. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/admin/departments');
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || 'Department filters could not be loaded.');
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [search, selectedDept, statusFilter]);

  const handleDeactivate = async (id, name) => {
    if (window.confirm(`Are you sure you want to deactivate student ${name}?`)) {
      try {
        await apiClient.delete(`/students/${id}`);
        fetchStudents();
      } catch (err) {
        setErrorMsg(err.response?.data?.detail || 'Could not deactivate student.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Student Directory</h1>
          <p className="text-xs text-slate-400 mt-1">Manage registered students, profile photos and face recognition profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchStudents} disabled={loading} className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50" title="Refresh student records"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <Link to="/students/new" className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition"><UserPlus className="w-4 h-4" /> Register New Student</Link>
        </div>
      </div>

      {errorMsg && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" />{errorMsg}</div>}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student by Name, ID, or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 flex-1 md:w-48"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {search || selectedDept || statusFilter ? 'No students match the selected filters.' : 'No students have been registered yet.'}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
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
                        <Link to={`/students/${student.id}`} className="font-semibold text-slate-100 hover:text-cyan-400 transition">
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
                          to={`/students/${student.id}`}
                          title="View Attendance & Borrowing Profile"
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/students/${student.id}/edit`}
                          title="Edit Student"
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        {student.status === 'Active' && (
                          <button
                            onClick={() => handleDeactivate(student.id, student.full_name)}
                            title="Deactivate Student"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
