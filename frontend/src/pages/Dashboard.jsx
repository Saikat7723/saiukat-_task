import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Building,
  Percent,
  BookOpen,
  BookCheck,
  BookMarked,
  Clock,
  ArrowUpRight,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import apiClient from '../api/axios';

const PIE_COLORS = ['#38bdf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa'];

export const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [attendanceChart, setAttendanceChart] = useState([]);
  const [librarySummary, setLibrarySummary] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, chartRes, libRes, recentRes] = await Promise.all([
        apiClient.get('/dashboard/summary'),
        apiClient.get('/dashboard/attendance-chart?days=7'),
        apiClient.get('/dashboard/library-summary'),
        apiClient.get('/attendance?limit=10')
      ]);
      setSummary(sumRes.data);
      setAttendanceChart(chartRes.data.daily || []);
      setLibrarySummary(libRes.data);
      setRecentAttendance(recentRes.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const filteredRecent = recentAttendance.filter(item =>
    item.student?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    item.student?.student_id?.toLowerCase().includes(search.toLowerCase())
  );
  const hasAttendanceData = attendanceChart.some(point => point.present > 0 || point.absent > 0);
  const hasLibraryData = [librarySummary?.available, librarySummary?.issued, librarySummary?.overdue].some(value => Number(value) > 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Library & Attendance Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time Library Entry/Exit Attendance & Book Circulation Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Students</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-100">{summary?.total_students || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{summary?.active_students || 0} Active Enrolled</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Present Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-400">{summary?.present_today || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{summary?.today_attendance_percentage || 0}% Attendance</span>
          </div>
        </div>

        {/* Currently Inside Library */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Currently Inside</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-400">{summary?.currently_inside || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Active Library Sessions</span>
          </div>
        </div>

        {/* Available Books */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Available Books</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <BookCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-100">{summary?.available_books || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Of {summary?.total_books || 0} Total Copies</span>
          </div>
        </div>

        {/* Overdue Books */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Overdue Books</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-rose-400">{summary?.overdue_books || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pending Fine Calculation</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200">Daily Attendance Trend</h2>
              <p className="text-[11px] text-slate-400">Student check-in count over past 7 days</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Weekly Trend
            </span>
          </div>
          <div className="h-64">
            {!hasAttendanceData ? <div className="h-full flex items-center justify-center text-sm text-slate-500">No attendance records have been recorded yet.</div> : <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceChart}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="present" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#attendanceGradient)" />
              </AreaChart>
            </ResponsiveContainer>}
          </div>
        </div>

        {/* Library Book Circulation Summary */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">Library Stock Breakdown</h2>
          <p className="text-[11px] text-slate-400 mb-4">Available vs Issued vs Overdue Books</p>
          <div className="h-52 flex items-center justify-center">
            {!hasLibraryData ? <p className="text-sm text-slate-500 text-center">No books have been added to the catalogue yet.</p> : <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Available', value: librarySummary?.available || 0 },
                    { name: 'Issued', value: librarySummary?.issued || 0 },
                    { name: 'Overdue', value: librarySummary?.overdue || 0 }
                  ]}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#34d399" />
                  <Cell fill="#38bdf8" />
                  <Cell fill="#f87171" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>}
          </div>
          {hasLibraryData && <div className="flex items-center justify-center gap-4 text-xs mt-2">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Available</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Issued</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> Overdue</div>
          </div>}
        </div>
      </div>

      {/* Recent Attendance Session Activity Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Recent Attendance Sessions</h2>
            <p className="text-[11px] text-slate-400">Live attendance check-in & check-out logs</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Check-In Time</th>
                <th className="px-4 py-3">Check-Out Time</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    No attendance sessions found.
                  </td>
                </tr>
              ) : (
                filteredRecent.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-cyan-400 font-bold shrink-0">
                        {sess.student?.profile_photo_path ? (
                          <img src={sess.student.profile_photo_path} alt="" className="w-full h-full object-cover" />
                        ) : (
                          sess.student?.full_name?.charAt(0) || 'S'
                        )}
                      </div>
                      <span className="font-semibold text-slate-200">{sess.student?.full_name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400">{sess.student?.student_id}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(sess.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {sess.check_out_time ? (
                        new Date(sess.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      ) : (
                        <span className="text-amber-400 font-medium">Inside Library</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {sess.duration_minutes > 0 ? `${sess.duration_minutes} mins` : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {sess.confidence ? `${Math.round(sess.confidence * 100)}%` : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        sess.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        sess.status === 'Late' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {sess.status}
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
