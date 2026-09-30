import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, CheckCircle2, Clock3,
  Camera, CameraOff, Edit3, KeyRound, Library, LogIn, LogOut, Mail, MapPin, Phone, Save,
  Upload, UserRound, X, XCircle
} from 'lucide-react';
import Webcam from 'react-webcam';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const EMPTY = '—';
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : EMPTY;
const attendanceDate = value => value ? new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : EMPTY;
const date = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : EMPTY;
const weekday = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString([], { weekday: 'short' }) : EMPTY;
const duration = minutes => Number(minutes) > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : EMPTY;
const statusTone = status => {
  if (status === 'Present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Late') return 'bg-amber-100 text-amber-700';
  if (status === 'Early Exit') return 'bg-orange-100 text-orange-700';
  if (status === 'Absent') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-700';
};

const Card = ({ children, className = '' }) => <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
const Empty = ({ children }) => <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
const AttendanceMoment = ({ value }) => value ? <div><p className="font-semibold text-slate-800">{time(value)}</p><p className="mt-0.5 text-xs text-slate-500">{attendanceDate(value)}</p></div> : <span className="text-slate-400">{EMPTY}</span>;

const profileFormFrom = student => ({
  full_name: student.full_name || '',
  dob: student.dob || '',
  gender: student.gender || '',
  phone: student.phone || '',
  address: student.address || '',
});

export const StudentPortal = ({ section = 'dashboard' }) => {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState({ current_password: '', new_password: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [historyFilters, setHistoryFilters] = useState({ from: '', to: '', status: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/student/dashboard');
      let next = response.data;
      if (section === 'attendance' || section === 'history') {
        const attendanceResponse = await apiClient.get('/student/attendance');
        next = { ...next, recent_attendance: attendanceResponse.data };
      }
      if (section === 'library') {
        const libraryResponse = await apiClient.get('/student/library');
        const history = libraryResponse.data;
        const activeBooks = history.filter(item => !item.return_date && ['ISSUED', 'OVERDUE'].includes(item.status));
        next = { ...next, library: { ...next.library, history, active_books: activeBooks, issued_count: activeBooks.length } };
      }
      setData(next);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load your student data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [section]);

  const openProfileEditor = async () => {
    if (!data?.student) return;
    setProfileForm(profileFormFrom(data.student));
    setProfilePhoto(null);
    setProfilePhotoPreview(data.student.profile_photo_path || '');
    setProfileMessage('');
    setProfileOpen(true);
    setProfileLoading(false);
  };

  const closeProfileEditor = () => {
    if (profilePhotoPreview && profilePhotoPreview.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
    setProfileOpen(false);
    setProfilePhoto(null);
    setProfilePhotoPreview('');
    setProfileMessage('');
  };

  const updateProfileField = (field, value) => setProfileForm(previous => ({ ...previous, [field]: value }));

  const setProfilePhotoFile = file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setProfileMessage('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setProfileMessage('Image must be smaller than 5 MB.'); return; }
    if (profilePhotoPreview.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
    setProfileMessage('');
  };

  const handlePhotoChange = event => setProfilePhotoFile(event.target.files?.[0]);

  const saveProfile = async event => {
    event.preventDefault();
    if (!profileForm) return;
    setProfileSaving(true);
    setProfileMessage('');
    let updatedStudent = null;
    try {
      const response = await apiClient.put('/student/profile', {
        ...profileForm,
        dob: profileForm.dob || null,
      });
      updatedStudent = response.data;
      setData(previous => ({ ...previous, student: updatedStudent }));
      updateUser({ full_name: updatedStudent.full_name, email: updatedStudent.email, student_id: updatedStudent.student_id, profile_photo_path: updatedStudent.profile_photo_path });

      if (profilePhoto) {
        const formData = new FormData();
        formData.append('file', profilePhoto, profilePhoto.name);
        const photoResponse = await apiClient.post('/student/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        updatedStudent = photoResponse.data;
        setData(previous => ({ ...previous, student: updatedStudent }));
        updateUser({ profile_photo_path: updatedStudent.profile_photo_path });
      }
      closeProfileEditor();
    } catch (requestError) {
      setProfileMessage(updatedStudent ? `Profile details saved, but the photo could not be updated: ${requestError.response?.data?.detail || 'try again.'}` : (requestError.response?.data?.detail || 'Profile could not be saved.'));
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-slate-500">Loading your portal…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  if (!data) return null;

  const student = data.student;
  const attendance = data.attendance || { attendance_percentage: 0, present_days: 0, absent_days: 0, total_working_days: 0, today_check_in: null, today_check_out: null };
  const sessions = data.recent_attendance || [];
  const library = data.library || { active_books: [], history: [], issued_count: 0 };
  const monthly = data.monthly_attendance || [];
  const historySessions = sessions.filter(item => (!historyFilters.from || item.session_date >= historyFilters.from) && (!historyFilters.to || item.session_date <= historyFilters.to) && (!historyFilters.status || item.status === historyFilters.status));
  const historyStatuses = Array.from(new Set(sessions.map(item => item.status).filter(Boolean))).sort();
  const invalidHistoryRange = Boolean(historyFilters.from && historyFilters.to && historyFilters.from > historyFilters.to);
  const inDays = new Set(sessions.filter(item => item.check_in_time).map(item => item.session_date)).size;
  const outDays = new Set(sessions.filter(item => item.check_out_time).map(item => item.session_date)).size;
  const totalMinutes = sessions.reduce((total, item) => total + (Number(item.duration_minutes) > 0 ? Number(item.duration_minutes) : 0), 0);
  const averageMinutes = inDays ? Math.round(totalMinutes / inDays) : 0;
  const todaySessions = sessions.filter(item => item.session_date === data.server_date);

  const changePassword = async event => {
    event.preventDefault();
    setPasswordMessage('');
    try {
      const response = await apiClient.put('/student/password', password);
      setPasswordMessage(response.data.message);
      setPassword({ current_password: '', new_password: '' });
    } catch (requestError) {
      setPasswordMessage(requestError.response?.data?.detail || 'Password update failed.');
    }
  };

  const profile = <Card className="overflow-hidden p-0"><div className="flex flex-col gap-6 p-6 lg:flex-row">
    <div className="flex h-64 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 lg:w-56">{student.profile_photo_path ? <img src={student.profile_photo_path} alt={student.full_name} className="h-full w-full object-cover" /> : <UserRound size={72} className="text-slate-400" />}</div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold text-slate-900">{student.full_name}</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{student.status}</span></div><p className="mt-1 text-sm text-slate-500">Unique Student ID: <span className="font-mono font-semibold text-blue-700">{student.student_id}</span></p><div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">{[['Full Name', student.full_name], ['Unique Student ID', student.student_id], ['Department', student.department?.name], ['Course', student.course?.name], ['Enrollment Year', student.enrollment_year], ['Date of Joining', date(student.date_of_joining)], ['Date of Birth', date(student.dob)], ['Gender', student.gender], ['Email', student.email], ['Phone', student.phone], ['Address', student.address]].map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{label}</span><span className={`break-words font-medium text-slate-800 ${label === 'Unique Student ID' ? 'font-mono text-blue-700' : ''}`}>{value || EMPTY}</span></div>)}</div></div>
    <button onClick={openProfileEditor} className="flex h-fit items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"><Edit3 size={15} />Edit Profile</button>
  </div></Card>;

  const summary = <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm"><CheckCircle2 size={28} /></div><div><p className="text-sm text-slate-500">Total Attendance</p><p className="mt-1 text-3xl font-bold text-slate-900">{attendance.attendance_percentage}%</p><p className="mt-1 text-xs text-slate-500">{attendance.present_days} Present / {attendance.absent_days} Absent</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><LogIn size={28} /></div><div><p className="text-sm text-slate-500">Today In Time</p><p className="mt-1 text-2xl font-bold text-slate-900">{time(attendance.today_check_in)}</p><p className="mt-1 text-xs text-slate-500">{date(data.server_date)}</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm"><LogOut size={28} /></div><div><p className="text-sm text-slate-500">Today Out Time</p><p className="mt-1 text-2xl font-bold text-slate-900">{time(attendance.today_check_out)}</p><p className="mt-1 text-xs text-slate-500">{date(data.server_date)}</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm"><Library size={28} /></div><div><p className="text-sm text-slate-500">Books Issued</p><p className="mt-1 text-3xl font-bold text-slate-900">{library.issued_count}</p><p className="mt-1 text-xs text-slate-500">Currently issued</p></div></Card></div>;

  const attendanceOverview = <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white"><CheckCircle2 size={28} /></div><div><p className="text-sm text-slate-500">Total Attendance</p><p className="mt-1 text-3xl font-bold text-slate-900">{attendance.attendance_percentage}%</p><p className="mt-1 text-xs text-slate-500">Based on recorded working days</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><CalendarDays size={28} /></div><div><p className="text-sm text-slate-500">Present Days</p><p className="mt-1 text-3xl font-bold text-slate-900">{attendance.present_days}</p><p className="mt-1 text-xs text-slate-500">of {attendance.total_working_days} working days</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white"><XCircle size={28} /></div><div><p className="text-sm text-slate-500">Absent Days</p><p className="mt-1 text-3xl font-bold text-slate-900">{attendance.absent_days}</p><p className="mt-1 text-xs text-slate-500">of {attendance.total_working_days} working days</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><CalendarDays size={28} /></div><div><p className="text-sm text-slate-500">Total Working Days</p><p className="mt-1 text-3xl font-bold text-slate-900">{attendance.total_working_days}</p><p className="mt-1 text-xs text-slate-500">Since enrollment</p></div></Card></div>;

  const attendanceTable = <Card><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{section === 'history' ? 'In/Out History' : 'Recent Attendance'}</h2>{section === 'dashboard' && <Link className="text-sm font-semibold text-blue-600" to="/student/attendance">View all</Link>}</div>{sessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Session date</th><th className="p-3">Check in</th><th className="p-3">Check out</th><th className="p-3">Duration</th><th className="p-3">Status</th></tr></thead><tbody>{sessions.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="p-3 text-slate-600">{date(item.session_date)}</td><td className="p-3"><AttendanceMoment value={item.check_in_time} /></td><td className="p-3"><AttendanceMoment value={item.check_out_time} /></td><td className="p-3">{duration(item.duration_minutes)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status || EMPTY}</span></td></tr>)}</tbody></table></div> : <Empty>No attendance records have been recorded for your account.</Empty>}</Card>;

  const libraryTable = <Card><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">My Library</h2>{section === 'dashboard' && <Link className="text-sm font-semibold text-blue-600" to="/student/library">View all</Link>}</div>{library.history.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Book Title</th><th className="p-3">Author</th><th className="p-3">Issue Date</th><th className="p-3">Return/Due Date</th><th className="p-3">Status</th></tr></thead><tbody>{library.history.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="p-3 font-medium">{item.book?.title || EMPTY}</td><td className="p-3">{item.book?.author || EMPTY}</td><td className="p-3">{date(item.issue_date)}</td><td className="p-3">{date(item.return_date || item.due_date)}</td><td className="p-3">{item.status || EMPTY}</td></tr>)}</tbody></table></div> : <Empty>No library issue records have been recorded for your account.</Empty>}</Card>;

  const attendanceChart = <Card><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Monthly Attendance</h2><span className="text-xs text-slate-500">Working days and verified attendance</span></div><div className="mt-4 h-64">{monthly.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="present" name="Present" fill="#27b58a" radius={[4, 4, 0, 0]} /><Bar dataKey="absent" name="Absent" fill="#e2e8f0" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty>No attendance data is available for the current year.</Empty>}</div></Card>;
  const attendanceSummary = <Card><h2 className="text-lg font-bold text-slate-900">Attendance Summary</h2><div className="mt-2 flex items-center gap-4"><div className="h-44 w-44 shrink-0">{attendance.present_days + attendance.absent_days > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Present Days', value: attendance.present_days }, { name: 'Absent Days', value: attendance.absent_days }]} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}><Cell fill="#27b58a" /><Cell fill="#f87171" /></Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-full border-[18px] border-slate-200 text-xs text-slate-500">No data</div>}</div><div className="space-y-3 text-sm"><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Present Days <strong className="ml-3">{attendance.present_days}</strong></p><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-400" />Absent Days <strong className="ml-3">{attendance.absent_days}</strong></p><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-300" />Total Working Days <strong className="ml-3">{attendance.total_working_days}</strong></p></div></div></Card>;

  const historyOverview = <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white"><LogIn size={28} /></div><div><p className="text-sm text-slate-500">Total In Days</p><p className="mt-1 text-3xl font-bold text-slate-900">{inDays}</p><p className="mt-1 text-xs text-slate-500">Recorded history</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white"><LogOut size={28} /></div><div><p className="text-sm text-slate-500">Total Out Days</p><p className="mt-1 text-3xl font-bold text-slate-900">{outDays}</p><p className="mt-1 text-xs text-slate-500">Recorded history</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Clock3 size={28} /></div><div><p className="text-sm text-slate-500">Average Working Hours</p><p className="mt-1 text-2xl font-bold text-slate-900">{duration(averageMinutes)}</p><p className="mt-1 text-xs text-slate-500">Per recorded in day</p></div></Card><Card className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><CalendarDays size={28} /></div><div><p className="text-sm text-slate-500">Total Hours</p><p className="mt-1 text-2xl font-bold text-slate-900">{duration(totalMinutes)}</p><p className="mt-1 text-xs text-slate-500">Recorded history</p></div></Card></div>;
  const historyFilterCard = <Card className="flex flex-wrap items-end gap-3"><label className="min-w-[170px] flex-1 text-sm text-slate-600">From date<input type="date" value={historyFilters.from} max={historyFilters.to || undefined} onChange={event => setHistoryFilters({ ...historyFilters, from: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label><label className="min-w-[170px] flex-1 text-sm text-slate-600">To date<input type="date" value={historyFilters.to} min={historyFilters.from || undefined} onChange={event => setHistoryFilters({ ...historyFilters, to: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label><label className="min-w-[170px] flex-1 text-sm text-slate-600">Status<select value={historyFilters.status} onChange={event => setHistoryFilters({ ...historyFilters, status: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="">All statuses</option>{historyStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select></label><button type="button" onClick={() => setHistoryFilters({ from: '', to: '', status: '' })} className="rounded-xl bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700">Reset</button>{invalidHistoryRange && <p className="basis-full text-sm text-red-600">The start date must be on or before the end date.</p>}</Card>;
  const historyRecords = <Card><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">In/Out Records</h2><p className="text-sm text-slate-500">{historySessions.length} matching record{historySessions.length === 1 ? '' : 's'}</p></div></div>{historySessions.length && !invalidHistoryRange ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Session date</th><th className="p-3">Day</th><th className="p-3">Check in</th><th className="p-3">Check out</th><th className="p-3">Total hours</th><th className="p-3">Status</th><th className="p-3">Camera</th></tr></thead><tbody>{historySessions.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="p-3">{date(item.session_date)}</td><td className="p-3">{weekday(item.session_date)}</td><td className="p-3"><AttendanceMoment value={item.check_in_time} /></td><td className="p-3"><AttendanceMoment value={item.check_out_time} /></td><td className="p-3">{duration(item.duration_minutes)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status || EMPTY}</span></td><td className="p-3">{item.camera_id || EMPTY}</td></tr>)}</tbody></table></div> : <Empty>{invalidHistoryRange ? 'No records can be shown for this date range.' : 'No in/out records match the selected filters.'}</Empty>}</Card>;
  const todayTimeline = <Card><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Today&apos;s Timeline</h2><p className="text-sm text-slate-500">{date(data.server_date)}</p></div><Clock3 className="text-blue-600" /></div>{todaySessions.length ? <div className="mt-5 space-y-5 border-l-2 border-blue-100 pl-5">{todaySessions.map(session => <div key={session.id} className="space-y-4"><div className="relative"><span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><LogIn size={13} /></span><p className="font-semibold text-slate-800">{time(session.check_in_time)} · Check in</p><p className="text-sm text-slate-500">{session.camera_id || 'Camera not recorded'}</p></div>{session.check_out_time && <div className="relative"><span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"><LogOut size={13} /></span><p className="font-semibold text-slate-800">{time(session.check_out_time)} · Check out</p><p className="text-sm text-slate-500">{session.camera_id || 'Camera not recorded'}</p></div>}<div className="rounded-xl bg-blue-50 p-4"><p className="text-sm text-slate-600">Session working time</p><p className="mt-1 text-2xl font-bold text-slate-900">{duration(session.duration_minutes)}</p></div></div>)}</div> : <Empty>No attendance has been recorded for today.</Empty>}</Card>;

  return <div className="mx-auto max-w-[1400px] space-y-5 text-slate-700"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">{section === 'dashboard' ? 'Student Dashboard' : section === 'profile' ? 'My Profile' : section === 'library' ? 'My Library' : section === 'settings' ? 'Settings' : section === 'history' ? 'In/Out History' : 'My Attendance'}</h1><p className="mt-1 text-slate-500">Profile, attendance and library information from your account</p></div><div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"><CalendarDays className="mr-2 inline text-blue-600" size={18} />{date(data.server_date)}</div></div>
    {section === 'dashboard' && <>{profile}{summary}<div className="grid gap-5 xl:grid-cols-2">{attendanceTable}{libraryTable}</div><div className="grid gap-5 xl:grid-cols-2">{attendanceChart}{attendanceSummary}</div></>}
    {section === 'profile' && profile}
    {section === 'attendance' && <>{attendanceOverview}<div className="grid gap-5 xl:grid-cols-2">{attendanceChart}{attendanceSummary}</div>{attendanceTable}</>}
    {section === 'history' && <>{historyOverview}{historyFilterCard}<div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">{historyRecords}{todayTimeline}</div></>}
    {section === 'library' && libraryTable}
    {section === 'notifications' && <Card><h2 className="text-lg font-bold">Notifications</h2><Empty>No notifications have been recorded for your account.</Empty></Card>}
    {section === 'settings' && <Card className="max-w-xl"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><KeyRound className="text-blue-600" /><h2 className="text-lg font-bold">Change Password</h2></div><button type="button" onClick={openProfileEditor} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"><Edit3 size={15} className="mr-1 inline" />Edit Profile</button></div><form onSubmit={changePassword} className="space-y-4"><input required type="password" minLength="8" placeholder="Current password" value={password.current_password} onChange={e => setPassword({ ...password, current_password: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3" /><input required type="password" minLength="8" placeholder="New password (8+ characters)" value={password.new_password} onChange={e => setPassword({ ...password, new_password: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3" /><button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Update password</button>{passwordMessage && <p className="text-sm text-slate-600">{passwordMessage}</p>}</form></Card>}
    {profileOpen && <ProfileModal student={student} form={profileForm} loading={profileLoading} saving={profileSaving} message={profileMessage} photoPreview={profilePhotoPreview} onChange={updateProfileField} onPhotoChange={handlePhotoChange} onPhotoFile={setProfilePhotoFile} onSubmit={saveProfile} onClose={closeProfileEditor} />}
  </div>;
};

const LegacyProfileModal = ({ student, form, departments, courses, loading, saving, message, photoPreview, onChange, onPhotoChange, onSubmit, onClose }) => {
  const availableCourses = courses.filter(course => !form?.department_id || String(course.department_id) === String(form.department_id));
  const handleDepartmentChange = event => {
    const departmentId = event.target.value;
    onChange('department_id', departmentId);
    if (form?.course_id && !courses.some(course => String(course.id) === String(form.course_id) && String(course.department_id) === String(departmentId))) onChange('course_id', '');
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-sm sm:p-6"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-8"><div><h2 className="text-2xl font-bold text-slate-900">Edit Profile</h2><p className="mt-1 text-sm text-slate-500">Update your personal and academic information</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close profile editor"><X /></button></div><form onSubmit={onSubmit} className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[210px_minmax(0,1fr)]"><div><div className="mx-auto h-48 w-48 overflow-hidden rounded-2xl bg-slate-100">{photoPreview ? <img src={photoPreview} alt={student.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><UserRound size={64} /></div>}</div><label className="mx-auto mt-3 flex w-48 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"><Upload size={16} /> Change Photo<input type="file" accept="image/*" onChange={onPhotoChange} className="sr-only" /></label><p className="mt-2 text-center text-xs text-slate-400">JPG or PNG, maximum 5 MB</p><p className="mt-3 text-center text-xs text-slate-500">One clear face is required for automatic attendance.</p></div><div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><ModalField label="Full Name" required><input required value={form?.full_name || ''} onChange={event => onChange('full_name', event.target.value)} className="profile-modal-input" /></ModalField><ModalField label="Roll Number"><input value={student.student_id || ''} disabled className="profile-modal-input bg-slate-100" /></ModalField></div><div className="grid gap-4 md:grid-cols-2"><ModalField label="Department"><select value={form?.department_id || ''} onChange={handleDepartmentChange} className="profile-modal-input"><option value="">Select Department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ModalField><ModalField label="Course"><select value={form?.course_id || ''} onChange={event => onChange('course_id', event.target.value)} className="profile-modal-input"><option value="">Select Course</option>{availableCourses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ModalField></div><div className="grid gap-4 md:grid-cols-2"><ModalField label="Enrollment Year"><input value={form?.date_of_joining ? new Date(`${form.date_of_joining}T00:00:00`).getFullYear() : ''} disabled placeholder="Not available" className="profile-modal-input bg-slate-100" /></ModalField><ModalField label="Date of Joining"><input type="date" value={form?.date_of_joining || ''} onChange={event => onChange('date_of_joining', event.target.value)} className="profile-modal-input" /></ModalField></div><div className="grid gap-4 md:grid-cols-2"><ModalField label="Date of Birth"><input type="date" value={form?.dob || ''} onChange={event => onChange('dob', event.target.value)} className="profile-modal-input" /></ModalField><ModalField label="Gender"><select value={form?.gender || ''} onChange={event => onChange('gender', event.target.value)} className="profile-modal-input"><option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></ModalField></div><div className="grid gap-4 md:grid-cols-2"><ModalField label="Email"><div className="relative"><Mail className="profile-modal-icon" size={16} /><input value={student.email || ''} disabled className="profile-modal-input bg-slate-100 pl-10" /></div></ModalField><ModalField label="Phone"><div className="relative"><Phone className="profile-modal-icon" size={16} /><input value={form?.phone || ''} onChange={event => onChange('phone', event.target.value)} placeholder="Enter phone number" className="profile-modal-input pl-10" /></div></ModalField></div><ModalField label="Address"><div className="relative"><MapPin className="profile-modal-icon top-3" size={16} /><textarea rows={3} value={form?.address || ''} onChange={event => onChange('address', event.target.value)} placeholder="Enter your address" className="profile-modal-input resize-none pl-10" /></div></ModalField>{message && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700" role="alert"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{message}</div>}<div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={17} />}{saving ? 'Saving…' : 'Save Changes'}</button></div></div></form></div></div>;
};

const ProfileModal = ({ student, form, loading, saving, message, photoPreview, onChange, onPhotoChange, onPhotoFile, onSubmit, onClose }) => {
  const webcamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    const stream = webcamRef.current?.video?.srcObject;
    stream?.getTracks?.().forEach(track => track.stop());
    setCameraOpen(false);
    setCameraError('');
  };

  const capturePhoto = async () => {
    const image = webcamRef.current?.getScreenshot();
    if (!image) {
      setCameraError('Camera is still starting. Please try again.');
      return;
    }
    const blob = await (await fetch(image)).blob();
    onPhotoFile(new File([blob], `student-${student.student_id}-photo.jpg`, { type: 'image/jpeg' }));
    stopCamera();
  };

  useEffect(() => () => {
    const stream = webcamRef.current?.video?.srcObject;
    stream?.getTracks?.().forEach(track => track.stop());
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-sm sm:p-6">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-8">
          <div><h2 className="text-2xl font-bold text-slate-900">Edit Profile</h2><p className="mt-1 text-sm text-slate-500">Update your personal and academic information</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close profile editor"><X /></button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside>
            <div className="mx-auto h-48 w-48 overflow-hidden rounded-2xl bg-slate-100">{photoPreview ? <img src={photoPreview} alt={student.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><UserRound size={64} /></div>}</div>
            {cameraOpen ? <div className="mx-auto mt-3 w-48"><div className="overflow-hidden rounded-xl bg-slate-950"><Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', width: 640, height: 480 }} onUserMediaError={() => setCameraError('Camera access was denied or is unavailable.')} className="aspect-square w-full object-cover" /></div>{cameraError && <p className="mt-2 text-xs text-rose-600">{cameraError}</p>}<div className="mt-2 flex gap-2"><button type="button" onClick={stopCamera} className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600"><CameraOff size={14} className="mr-1 inline" />Close</button><button type="button" onClick={capturePhoto} className="flex-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white"><Camera size={14} className="mr-1 inline" />Capture</button></div></div> : <div className="mx-auto mt-3 flex w-48 gap-2"><button type="button" onClick={() => setCameraOpen(true)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 py-2 text-xs font-semibold text-white"><Camera size={15} /> Camera</button><label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700"><Upload size={15} /> Upload<input type="file" accept="image/*" onChange={onPhotoChange} className="sr-only" /></label></div>}
            <p className="mt-2 text-center text-xs text-slate-400">JPG or PNG, maximum 5 MB</p><p className="mt-3 text-center text-xs text-slate-500">One clear face is required for automatic attendance.</p>
          </aside>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2"><ModalField label="Full Name" required><input required value={form?.full_name || ''} onChange={event => onChange('full_name', event.target.value)} className="profile-modal-input" /></ModalField><ModalField label="Unique Student ID"><input value={student.student_id || ''} disabled className="profile-modal-input bg-slate-100 font-mono" /><p className="mt-1 text-xs text-slate-400">Generated by the institution and cannot be changed.</p></ModalField></div>
            <div className="grid gap-4 md:grid-cols-2"><ModalField label="Department"><input value={student.department?.name || 'Not assigned'} disabled className="profile-modal-input bg-slate-100" /><p className="mt-1 text-xs text-slate-400">Managed by an administrator.</p></ModalField><ModalField label="Course"><input value={student.course?.name || 'Not assigned'} disabled className="profile-modal-input bg-slate-100" /><p className="mt-1 text-xs text-slate-400">Managed by an administrator.</p></ModalField></div>
            <div className="grid gap-4 md:grid-cols-2"><ModalField label="Date of Joining"><input value={student.date_of_joining || 'Not assigned'} disabled className="profile-modal-input bg-slate-100" /><p className="mt-1 text-xs text-slate-400">Managed by an administrator.</p></ModalField><ModalField label="Date of Birth"><input type="date" value={form?.dob || ''} onChange={event => onChange('dob', event.target.value)} className="profile-modal-input" /></ModalField></div>
            <div className="grid gap-4 md:grid-cols-2"><ModalField label="Gender"><select value={form?.gender || ''} onChange={event => onChange('gender', event.target.value)} className="profile-modal-input"><option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></ModalField><ModalField label="Phone"><div className="relative"><Phone className="profile-modal-icon" size={16} /><input value={form?.phone || ''} onChange={event => onChange('phone', event.target.value)} placeholder="Enter phone number" className="profile-modal-input profile-modal-has-icon" /></div></ModalField></div>
            <ModalField label="Email"><div className="relative"><Mail className="profile-modal-icon" size={16} /><input value={student.email || ''} disabled className="profile-modal-input profile-modal-has-icon bg-slate-100" /></div></ModalField>
            <ModalField label="Address"><div className="relative"><MapPin className="profile-modal-icon profile-modal-textarea-icon" size={16} /><textarea rows={3} value={form?.address || ''} onChange={event => onChange('address', event.target.value)} placeholder="Enter your address" className="profile-modal-input profile-modal-has-icon resize-none" /></div></ModalField>
            {message && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700" role="alert"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{message}</div>}
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={17} />}{saving ? 'Saving...' : 'Save Changes'}</button></div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ModalField = ({ label, required, children }) => <label className="block text-sm font-medium text-slate-600">{label}{required && <span className="ml-1 text-rose-500">*</span>}<span className="mt-1 block">{children}</span></label>;
