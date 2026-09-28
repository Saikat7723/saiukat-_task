import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Save, UserPlus } from 'lucide-react';
import apiClient from '../api/axios';
import { WebcamCapture } from '../components/common/WebcamCapture';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  student_id: '', full_name: '', email: '', password: '', phone: '',
  department_id: '', course_id: '', dob: '', gender: '',
  date_of_joining: today(), address: '', status: 'Active',
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
  address: student.address || '',
  status: student.status || 'Active',
});

export const StudentAdd = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [formData, setFormData] = useState(emptyForm);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [confirmedPhotoBlob, setConfirmedPhotoBlob] = useState(null);
  const [confirmedPhotoPreview, setConfirmedPhotoPreview] = useState(null);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [academicError, setAcademicError] = useState('');

  const selectedDepartment = useMemo(() => formData.department_id, [formData.department_id]);

  useEffect(() => {
    let mounted = true;
    const loadAcademic = async () => {
      setAcademicLoading(true);
      setAcademicError('');
      try {
        const [departmentResponse, courseResponse] = await Promise.all([
          apiClient.get('/admin/departments'),
          apiClient.get('/admin/courses'),
        ]);
        if (!mounted) return;
        setDepartments(Array.isArray(departmentResponse.data) ? departmentResponse.data : []);
        setCourses(Array.isArray(courseResponse.data) ? courseResponse.data : []);
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
    setFormData(previous => ({ ...previous, [field]: value }));
    setErrorMsg('');
  };

  const handlePhotoConfirmed = (blob, previewUrl) => {
    setConfirmedPhotoBlob(blob);
    setConfirmedPhotoPreview(previewUrl);
    setErrorMsg('');
  };

  const formPayload = () => {
    const payload = {
      ...formData,
      dob: formData.dob || null,
      date_of_joining: formData.date_of_joining || null,
      department_id: formData.department_id ? Number(formData.department_id) : null,
      course_id: formData.course_id ? Number(formData.course_id) : null,
    };
    if (editing) delete payload.password;
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
      navigate(`/students/${savedStudent.id}`, {
        state: { message: confirmedPhotoBlob ? 'Student saved and face profile enrolled.' : 'Student saved. Enrol a face photo from this profile before using automatic attendance.' },
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
        <button type="button" onClick={() => navigate('/students')} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"><ArrowLeft className="w-4 h-4" /> Back to Student Directory</button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">{editing ? <Save className="w-5 h-5 text-cyan-400" /> : <UserPlus className="w-5 h-5 text-cyan-400" />}{editing ? 'Edit Student' : 'Register Student'}</h1>
      </div>

      {errorMsg && <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-3" role="alert"><AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" /><div><p className="font-semibold">Could not save student</p><p className="mt-0.5">{errorMsg}</p></div></div>}
      {academicError && <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">{academicError}</div>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2"><h2 className="text-sm font-bold text-slate-200">Personal &amp; Academic Information</h2>{academicLoading && <span className="text-[11px] text-slate-500">Loading options…</span>}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Student ID / Roll No *"><input required value={formData.student_id} onChange={e => updateField('student_id', e.target.value)} placeholder="Enter roll number" className="form-input" /></Field><Field label="Full Name *"><input required value={formData.full_name} onChange={e => updateField('full_name', e.target.value)} placeholder="Enter full name" className="form-input" /></Field></div>
          {!editing && !createdStudent && <Field label="Student portal password *"><input required minLength={8} type="password" value={formData.password} onChange={e => updateField('password', e.target.value)} placeholder="At least 8 characters" className="form-input" /><small className="form-help">The student will use the roll number or email with this password.</small></Field>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Email Address *"><input required type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="Enter student email" className="form-input" /></Field><Field label="Phone Number"><input value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="Enter phone number" className="form-input" /></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Department"><select value={formData.department_id} onChange={e => updateField('department_id', e.target.value)} className="form-input"><option value="">No department selected</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></Field><Field label="Course"><select value={formData.course_id} onChange={e => updateField('course_id', e.target.value)} className="form-input"><option value="">No course selected</option>{courses.filter(course => !selectedDepartment || String(course.department_id) === String(selectedDepartment)).map(course => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}</select></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Date of Birth"><input type="date" value={formData.dob} onChange={e => updateField('dob', e.target.value)} className="form-input" /></Field><Field label="Date of Joining"><input type="date" value={formData.date_of_joining} onChange={e => updateField('date_of_joining', e.target.value)} className="form-input" /></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Gender"><select value={formData.gender} onChange={e => updateField('gender', e.target.value)} className="form-input"><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></Field><Field label="Status"><select value={formData.status} onChange={e => updateField('status', e.target.value)} className="form-input"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field></div>
          <Field label="Residential Address"><textarea rows={3} value={formData.address} onChange={e => updateField('address', e.target.value)} placeholder="Residential address" className="form-input resize-none" /></Field>

          <button type="submit" disabled={submitting} className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{submitting ? 'Saving…' : editing ? 'Save Student Changes' : 'Create Student Profile'}</button>
        </div>

        <div className="space-y-4"><WebcamCapture onCaptureConfirmed={handlePhotoConfirmed} isSubmitting={submitting} /><div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400"><p className="font-semibold text-slate-200">Face profile enrollment</p><p className="mt-1">A clear single-face photo is required before automatic attendance can recognize this student. You can save the student first and enroll the face later from the profile.</p></div>{confirmedPhotoPreview && <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"><div className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-500/40 shrink-0"><img src={confirmedPhotoPreview} alt="Selected student face" className="w-full h-full object-cover" /></div><div className="text-xs text-emerald-300"><p className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Face photo ready</p><p className="text-[11px] text-emerald-400/80">It will be validated and enrolled when you save.</p></div></div>}</div>
      </form>
    </div>
  );
};

const Field = ({ label, children }) => <label className="block text-xs font-medium text-slate-300">{label}<span className="block mt-1">{children}</span></label>;
