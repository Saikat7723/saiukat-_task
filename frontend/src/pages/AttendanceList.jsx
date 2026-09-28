import React, { useState, useEffect } from 'react';
import { CalendarCheck, Search, Filter, Download, Plus, Clock } from 'lucide-react';
import apiClient from '../api/axios';

export const AttendanceList = () => {
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let url = '/attendance?limit=200';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (deptFilter) url += `&department_id=${deptFilter}`;
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;

      const res = await apiClient.get(url);
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepts = async () => {
    try {
      const res = await apiClient.get('/admin/departments');
      setDepartments(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [search, deptFilter, statusFilter, dateFrom, dateTo]);

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (deptFilter) params.department_id = deptFilter;
      const response = await apiClient.get('/attendance/export/csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Could not export attendance report', error);
      alert('Could not export attendance report. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Library Attendance History</h1>
          <p className="text-xs text-slate-400 mt-1">Daily library check-in/out session records & duration tracking</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          Export CSV Report
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Student ID</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Check In</th>
                <th className="px-5 py-3.5">Check Out</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">Loading attendance logs...</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">No attendance records match criteria.</td>
                </tr>
              ) : (
                sessions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-100">{s.student?.full_name}</td>
                    <td className="px-5 py-3.5 font-mono text-cyan-400">{s.student?.student_id}</td>
                    <td className="px-5 py-3.5">{s.student?.department_name || '-'}</td>
                    <td className="px-5 py-3.5 text-slate-200">{s.session_date}</td>
                    <td className="px-5 py-3.5">{new Date(s.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3.5">
                      {s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                        <span className="text-amber-400 font-semibold">Active Session</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{s.duration_minutes > 0 ? `${s.duration_minutes}m` : '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {s.status}
                      </span>
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
