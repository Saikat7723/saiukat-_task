import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Save, UserPlus } from 'lucide-react';
import apiClient from '../api/axios';
import { WebcamCapture } from '../components/common/WebcamCapture';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  student_id: '', full_name: '', email: '', password: '', phone: '',
  department_id: '', course_id: '', dob: '', gender: '',
  date_of_joining: today(), semester: '', enrollment_year: String(new Date().getFullYear()),
  address: '', emergency_phone: '', remarks: '', library_member: true, status: 'Active',
});

const toFormData = student => ({
  student_id: student.student_id || '',
  full_name: student.full_name || '',
  email: student.email || '',
  password: '',
  phone: student.phone || '',
  department_id: student.department_id ? String(student.department_id) : '',
  course_id: student.course_id ? String(student.course_id) : '',
  dob: student.dob || '',
  gender: student.gender || '',
  date_of_joining: student.date_of_joining || '',
  semester: student.semester || '',
  enrollment_year: student.enrollment_year ? String(student.enrollment_year) : '',
  address: student.address || '',
  emergency_phone: student.emergency_phone || '',
  remarks: student.remarks || '',
  library_member: student.library_member !== false,
  status: student.status || 'Active',
});

export const StudentAdd = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const formRef = useRef(null);
  const [formData, setFormData] = useState(emptyForm);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [confirmedPhotoBlob, setConfirmedPhotoBlob] = useState(null);
  const [confirmedPhotoPreview, setConfirmedPhotoPreview] = useState(null);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [academicError, setAcademicError] = useState('');

  const selectedDepartment = useMemo(() => formData.department_id, [formData.department_id]);

  useEffect(() => {
    let mounted = true;
    const loadAcademic = async () => {
      setAcademicLoading(true);
      setAcademicError('');
      try {
        const departmentResponse = await apiClient.get('/admin/departments');
        if (!mounted) return;
        setDepartments(Array.isArray(departmentResponse.data) ? departmentResponse.data : []);
      } catch (error) {
        if (mounted) setAcademicError(error.response?.data?.detail || 'Academic options could not be loaded. You can save the student without them.');
      } finally {
        if (mounted) setAcademicLoading(false);
      }
    };
    loadAcademic();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setCourses([]);
      return undefined;
    }
    let mounted = true;
    apiClient.get(`/admin/courses?department_id=${encodeURIComponent(selectedDepartment)}`)
      .then(response => { if (mounted) setCourses(Array.isArray(response.data) ? response.data : []); })
      .catch(error => { if (mounted) setAcademicError(error.response?.data?.detail || 'Courses could not be loaded.'); });
    return () => { mounted = false; };
  }, [selectedDepartment]);

  useEffect(() => {
    if (editing) return undefined;
    let mounted = true;
    apiClient.get('/students/next-id')
      .then(response => {
        if (mounted) setFormData(previous => ({ ...previous, student_id: response.data.student_id || '' }));
      })
      .catch(error => { if (mounted) setErrorMsg(error.response?.data?.detail || 'The next student ID could not be generated.'); });
    return () => { mounted = false; };
  }, [editing]);

  useEffect(() => {
    if (!editing) return undefined;
    let mounted = true;
    const loadStudent = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const response = await apiClient.get(`/students/${id}`);
        if (mounted) setFormData(toFormData(response.data));
      } catch (error) {
        if (mounted) setErrorMsg(error.response?.data?.detail || 'Student record could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadStudent();
    return () => { mounted = false; };
  }, [editing, id]);

  const updateField = (field, value) => {
    setFormData(previous => ({
      ...previous,
      [field]: value,
      ...(field === 'department_id' ? { course_id: '' } : {}),
    }));
    setErrorMsg('');
  };

  const handlePhotoConfirmed = (blob, previewUrl) => {
    setConfirmedPhotoBlob(blob);
    setConfirmedPhotoPreview(previewUrl);
    setErrorMsg('');
  };

  const handlePhotoCleared = () => {
    setConfirmedPhotoBlob(null);
    setConfirmedPhotoPreview(null);
  };

  const formPayload = () => {
    const payload = {
      ...formData,
      dob: formData.dob || null,
      date_of_joining: formData.date_of_joining || null,
      department_id: formData.department_id ? Number(formData.department_id) : null,
      course_id: formData.course_id ? Number(formData.course_id) : null,
      enrollment_year: formData.enrollment_year ? Number(formData.enrollment_year) : null,
    };
    if (editing) delete payload.password;
    else delete payload.student_id;
    return payload;
  };

  const uploadPhoto = async student => {
    const photoFormData = new FormData();
    photoFormData.append('file', confirmedPhotoBlob, `${student.student_id}.jpg`);
    return apiClient.post(`/students/${student.id}/photo`, photoFormData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setErrorMsg('');
    if (!editing && !createdStudent && formData.password.length < 8) {
      setErrorMsg('Student portal password must contain at least 8 characters.');
      return;
    }

    setSubmitting(true);
    let savedStudent = null;
    try {
      if (editing) {
        const response = await apiClient.put(`/students/${id}`, formPayload());
        savedStudent = response.data;
      } else if (createdStudent) {
        savedStudent = createdStudent;
      } else {
        const response = await apiClient.post('/students', formPayload());
        savedStudent = response.data;
        setCreatedStudent(savedStudent);
      }

      if (confirmedPhotoBlob) await uploadPhoto(savedStudent);
      navigate('/admin/students', {
        state: { message: confirmedPhotoBlob ? 'Student added successfully and face profile enrolled.' : 'Student added successfully. Enrol a face photo from the student profile before using automatic attendance.' },
      });
    } catch (error) {
      const detail = error.response?.data?.detail || 'The student could not be saved. Check the fields and try again.';
      setErrorMsg(savedStudent && confirmedPhotoBlob
        ? `Student details were saved, but face enrollment failed: ${detail} You can retry the photo from this page or the student profile.`
        : detail);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-slate-400"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p>Loading student record...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/admin/students')} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"><ArrowLeft className="w-4 h-4" /> Back to Students</button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">{editing ? <Save className="w-5 h-5 text-cyan-400" /> : <UserPlus className="w-5 h-5 text-cyan-400" />}{editing ? 'Edit Student' : 'Register Student'}</h1>
      </div>

      {errorMsg && <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-3" role="alert"><AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" /><div><p className="font-semibold">Could not save student</p><p className="mt-0.5">{errorMsg}</p></div></div>}
      {academicError && <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">{academicError}</div>}

      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2"><h2 className="text-sm font-bold text-slate-200">Personal &amp; Academic Information</h2>{academicLoading && <span className="text-[11px] text-slate-500">Loading options…</span>}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Student ID / Roll No"><input value={formData.student_id || 'Generating…'} readOnly={!editing} onChange={e => updateField('student_id', e.target.value)} className={`form-input font-mono ${editing ? '' : 'bg-slate-950/40 text-cyan-300'}`} /><small className="form-help">{editing ? 'Only administrators can change this unique roll number.' : 'Generated automatically by the system.'}</small></Field><Field label="Full Name *"><input required value={formData.full_name} onChange={e => updateField('full_name', e.target.value)} placeholder="Enter full name" className="form-input" /></Field></div>
          {!editing && !createdStudent && <Field label="Student portal password *"><div className="relative"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => updateField('password', e.target.value)} placeholder="At least 8 characters" className="form-input pr-11" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-300">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><small className="form-help">The student will use the roll number or email with this password.</small></Field>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Email Address *"><input required type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="Enter student email" className="form-input" /></Field><Field label="Phone Number"><input value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="Enter phone number" className="form-input" /></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Department"><select value={formData.department_id} onChange={e => updateField('department_id', e.target.value)} className="form-input"><option value="">No department selected</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></Field><Field label="Course"><select value={formData.course_id} onChange={e => updateField('course_id', e.target.value)} disabled={!selectedDepartment} className="form-input disabled:opacity-60"><option value="">{selectedDepartment ? 'No course selected' : 'Select a department first'}</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}</select></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Date of Birth"><input type="date" value={formData.dob} onChange={e => updateField('dob', e.target.value)} className="form-input" /></Field><Field label="Date of Joining"><input type="date" value={formData.date_of_joining} onChange={e => updateField('date_of_joining', e.target.value)} className="form-input" /></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Semester / Year"><input value={formData.semester} onChange={e => updateField('semester', e.target.value)} placeholder="e.g. Semester 3" className="form-input" /></Field><Field label="Enrollment Year"><select value={formData.enrollment_year} onChange={e => updateField('enrollment_year', e.target.value)} className="form-input"><option value="">Select enrollment year</option>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map(year => <option key={year} value={year}>{year}</option>)}</select></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Gender"><select value={formData.gender} onChange={e => updateField('gender', e.target.value)} className="form-input"><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></Field><Field label="Status"><select value={formData.status} onChange={e => updateField('status', e.target.value)} className="form-input"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Emergency Contact"><input value={formData.emergency_phone} onChange={e => updateField('emergency_phone', e.target.value)} placeholder="Emergency phone number" className="form-input" /></Field><Field label="Library Membership"><select value={formData.library_member ? 'yes' : 'no'} onChange={e => updateField('library_member', e.target.value === 'yes')} className="form-input"><option value="yes">Library member</option><option value="no">No library access</option></select></Field></div>
          <Field label="Residential Address"><textarea rows={3} value={formData.address} onChange={e => updateField('address', e.target.value)} placeholder="Residential address" className="form-input resize-none" /></Field>
          <Field label="Remarks"><textarea rows={2} value={formData.remarks} onChange={e => updateField('remarks', e.target.value)} placeholder="Optional notes about the student" className="form-input resize-none" /></Field>

          <div className="flex gap-3"><button type="button" disabled={submitting} onClick={() => navigate('/admin/students')} className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">Cancel</button><button type="submit" disabled={submitting} className="flex-[2] py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{submitting ? 'Saving…' : editing ? 'Save Student Changes' : 'Save Student'}</button></div>
        </div>

        <div className="space-y-4"><WebcamCapture onCaptureConfirmed={handlePhotoConfirmed} onCaptureCleared={handlePhotoCleared} autoConfirm isSubmitting={submitting} onSaveClicked={() => { if (formRef.current) formRef.current.requestSubmit(); }} /><div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400"><p className="font-semibold text-slate-200">Face profile enrollment</p><p className="mt-1">Capture or upload a clear single-face photo. It is attached to this student and validated for face attendance when you save.</p></div>{confirmedPhotoPreview && <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"><div className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-500/40 shrink-0"><img src={confirmedPhotoPreview} alt="Selected student face" className="w-full h-full object-cover" /></div><div className="text-xs text-emerald-300"><p className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Photo attached</p><p className="text-[11px] text-emerald-400/80">It will be validated and enrolled when you save.</p></div></div>}</div>
      </form>
    </div>
  );
};

const Field = ({ label, children }) => <label className="block text-xs font-medium text-slate-300">{label}<span className="block mt-1">{children}</span></label>;
