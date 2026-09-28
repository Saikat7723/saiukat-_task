import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  User,
  CalendarCheck,
  Clock,
  BookOpen,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import apiClient from '../api/axios';
import { WebcamCapture } from '../components/common/WebcamCapture';

export const StudentDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [bookIssues, setBookIssues] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [notice, setNotice] = useState(location.state?.message || '');
  const savePhoto = async blob => {
    setSavingPhoto(true); setPhotoError('');
    try {
      const form = new FormData(); form.append('file', blob, 'profile.jpg');
      const { data } = await apiClient.post(`/students/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStudent(data); setEnrolling(false);
    } catch (error) { setPhotoError(error.response?.data?.detail || 'Could not enroll this photo. Please try again.'); }
    finally { setSavingPhoto(false); }
  };

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [stuRes, sumRes, sessRes, bookRes, calRes] = await Promise.all([
        apiClient.get(`/students/${id}`),
        apiClient.get(`/attendance/student/${id}/summary`),
        apiClient.get(`/attendance?student_id=${id}&limit=50`),
        apiClient.get(`/book-issues?student_id=${id}&limit=50`),
        apiClient.get(`/attendance/student/${id}/calendar?year=${selectedYear}&month=${selectedMonth}`)
      ]);
      setStudent(stuRes.data);
      setSummaryStats(sumRes.data);
      setAttendanceSessions(sessRes.data);
      setBookIssues(bookRes.data);
      setCalendarData(calRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, selectedYear, selectedMonth]);

  if (loading || !student) {
    return (
      <div className="py-12 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading Student Profile...</p>
      </div>
    );
  }

  // Generate calendar grid for selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Date(2000, index, 1).toLocaleString([], { month: 'long' }) }));
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="w-4 h-4" />
        Back to Student Directory
      </Link>

      {notice && <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="text-emerald-200 hover:text-white" aria-label="Dismiss message">×</button></div>}

      {/* Header Profile Summary */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center text-cyan-400 font-bold text-2xl shrink-0 shadow-lg">
            {student.profile_photo_path ? (
              <img src={student.profile_photo_path} alt="" className="w-full h-full object-cover" />
            ) : (
              student.full_name.charAt(0)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">{student.full_name}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {student.status}
              </span>
            </div>
            <p className="text-xs font-mono text-cyan-400 mt-0.5">Roll Number: {student.student_id}</p>
            <p className="text-xs text-slate-400 mt-1">
              {student.department?.name || '—'} · {student.course?.name || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Email</span>
            <span className="text-slate-200 font-semibold">{student.email}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Phone</span>
            <span className="text-slate-200 font-semibold">{student.phone || '—'}</span>
          </div>
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <p className={student.has_face_profile ? 'text-emerald-300' : 'text-amber-300'}>{student.has_face_profile ? 'Face enrolled for automatic attendance' : 'Face enrollment required: capture a clear, current photo.'}</p>
        <button onClick={() => setEnrolling(!enrolling)} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm">{enrolling ? 'Close camera' : student.has_face_profile ? 'Update face photo' : 'Enrol face'}</button>
        {photoError && <p role="alert" className="text-rose-300">{photoError}</p>}
        {enrolling && <div className="max-w-lg"><WebcamCapture onCaptureConfirmed={savePhoto} isSubmitting={savingPhoto} /></div>}
      </section>
      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 font-medium block">Working Days</span>
          <span className="text-xl font-bold text-slate-100 mt-1 block">{summaryStats?.total_working_days || 0}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 font-medium block">Present Days</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{summaryStats?.present_days || 0}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 font-medium block">Absent Days</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block">{summaryStats?.absent_days || 0}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 font-medium block">Attendance %</span>
          <span className="text-xl font-bold text-cyan-400 mt-1 block">{summaryStats?.attendance_percentage || 0}%</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs text-slate-400 font-medium block">Avg Duration</span>
          <span className="text-xl font-bold text-indigo-400 mt-1 block">{summaryStats?.avg_duration_minutes || 0}m</span>
        </div>
      </div>

      {/* Attendance Calendar & Visual States */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-cyan-400" />
              Attendance Calendar View
            </h2>
            <p className="text-[11px] text-slate-400">Monthly visual attendance records</p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="py-1.5 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {monthOptions.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="py-1.5 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></span> Present</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40"></span> Absent</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40"></span> Holiday</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-950 border border-slate-800"></span> No Data</div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {monthDays.map(day => {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const sess = calendarData?.sessions?.[dateStr];
            const hol = calendarData?.holidays?.[dateStr];

            let cellBg = 'bg-slate-950 border-slate-800/80 text-slate-400';
            if (sess) {
              cellBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold';
            } else if (hol) {
              cellBg = 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold';
            }

            return (
              <div
                key={day}
                className={`h-16 p-2 rounded-xl border flex flex-col justify-between text-xs transition ${cellBg}`}
              >
                <span className="text-[11px]">{day}</span>
                {sess ? (
                  <span className="text-[10px] truncate">{sess.check_in}</span>
                ) : hol ? (
                  <span className="text-[9px] truncate font-normal">{hol}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-slate-200">Attendance Session History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {attendanceSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">No attendance sessions recorded yet.</td>
                </tr>
              ) : (
                attendanceSessions.map(sess => (
                  <tr key={sess.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-200">{sess.session_date}</td>
                    <td className="px-4 py-3">{new Date(sess.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3">
                      {sess.check_out_time ? new Date(sess.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Session'}
                    </td>
                    <td className="px-4 py-3">{sess.duration_minutes > 0 ? `${sess.duration_minutes}m` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

      {/* Book Borrowing History */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-slate-200">Library Book Borrowing History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Book Title</th>
                <th className="px-4 py-3">ISBN</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Return Date</th>
                <th className="px-4 py-3">Fine</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {bookIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">No book issues recorded for this student.</td>
                </tr>
              ) : (
                bookIssues.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-200">{issue.book?.title}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400">{issue.book?.isbn}</td>
                    <td className="px-4 py-3">{issue.issue_date}</td>
                    <td className="px-4 py-3 text-slate-300">{issue.due_date}</td>
                    <td className="px-4 py-3">{issue.return_date || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-rose-400">${issue.fine_amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        issue.status === 'ISSUED' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                        issue.status === 'RETURNED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {issue.status}
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
