import React, { useState, useEffect } from 'react';
import { FileBarChart, Download, Printer, Filter, Building, UserCheck } from 'lucide-react';
import apiClient from '../api/axios';

export const AttendanceReports = () => {
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let url = '/attendance?limit=500';
      if (selectedDept) url += `&department_id=${selectedDept}`;
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;

      const res = await apiClient.get(url);
      setSessions(res.data);
    } catch (e) {
      console.error(e);
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
    fetchReportData();
  }, [selectedDept, dateFrom, dateTo]);

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (selectedDept) params.department_id = selectedDept;
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-cyan-400" />
            Attendance Reports & Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">Generate printable & downloadable library attendance reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            Print Report / Save PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-cyan-600/20 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-3 print:hidden">
        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none flex-1"
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

      {/* Printable Report Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none">
        <div className="text-center pb-6 border-b border-slate-800 print:border-gray-300">
          <h2 className="text-2xl font-bold text-slate-100 print:text-gray-900">Official Library Attendance Summary Report</h2>
          <p className="text-xs text-slate-400 print:text-gray-600 mt-1">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 print:text-gray-800">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
              {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading attendance records...</td></tr> : sessions.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No attendance records match the selected filters.</td></tr> : sessions.map((s, idx) => (
                <tr key={s.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-200 print:text-gray-900">{s.student?.full_name}</td>
                  <td className="px-4 py-3 font-mono text-cyan-400 print:text-gray-900">{s.student?.student_id}</td>
                  <td className="px-4 py-3">{s.student?.department_name || '-'}</td>
                  <td className="px-4 py-3">{s.session_date}</td>
                  <td className="px-4 py-3">{new Date(s.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3">
                    {s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                  </td>
                  <td className="px-4 py-3">{s.duration_minutes > 0 ? `${s.duration_minutes}m` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
