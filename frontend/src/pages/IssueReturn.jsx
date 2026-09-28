import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, CheckCircle2, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import apiClient from '../api/axios';

const localDateISO = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

export const IssueReturn = () => {
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeIssues, setActiveIssues] = useState([]);

  // Issue Form State
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [dueDate, setDueDate] = useState(() => localDateISO(14));

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [stuRes, bookRes, issueRes] = await Promise.all([
        apiClient.get('/students?status_filter=Active&limit=200'),
        apiClient.get('/books?limit=200'),
        apiClient.get('/book-issues?status_filter=ACTIVE')
      ]);
      const nextStudents = Array.isArray(stuRes.data) ? stuRes.data : [];
      const nextBooks = Array.isArray(bookRes.data) ? bookRes.data : [];
      const nextIssues = Array.isArray(issueRes.data) ? issueRes.data : [];
      setStudents(nextStudents);
      setBooks(nextBooks);
      setActiveIssues(nextIssues);
      setSelectedStudent(current => nextStudents.some(student => String(student.id) === String(current)) ? current : '');
      setSelectedBook(current => nextBooks.some(book => String(book.id) === String(current) && book.available_copies > 0 && book.status !== 'Discontinued') ? current : '');
    } catch (e) {
      setStudents([]);
      setBooks([]);
      setActiveIssues([]);
      setSelectedStudent('');
      setSelectedBook('');
      setLoadError(e.response?.data?.detail || 'Student, book and issue records could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleIssueBook = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!selectedStudent || !selectedBook) {
      setMsg({ type: 'error', text: 'Select an active student and an available book first.' });
      return;
    }
    try {
      await apiClient.post('/book-issues', {
        student_id: parseInt(selectedStudent),
        book_id: parseInt(selectedBook),
        due_date: dueDate
      });
      setMsg({ type: 'success', text: 'Book successfully issued to student!' });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Could not issue book.' });
    }
  };

  const handleReturnBook = async (issueId) => {
    try {
      await apiClient.post(`/book-issues/${issueId}/return`, {
        return_date: localDateISO(),
        fine_amount: 0.0
      });
      setMsg({ type: 'success', text: 'Book returned successfully!' });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Return failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex items-start justify-between gap-4">
        <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-cyan-400" />
          Book Issue & Return Station
        </h1>
        <p className="text-xs text-slate-400 mt-1">Check out books to registered students and process book returns</p>
        </div>
        <button type="button" onClick={fetchData} disabled={loading} className="shrink-0 rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50" title="Refresh students, books and issue records" aria-label="Refresh issue and return data"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}
      {loadError && <div className="p-4 rounded-xl text-xs flex items-center gap-2.5 bg-rose-500/10 text-rose-300 border border-rose-500/30"><AlertTriangle className="w-4 h-4" /><span>{loadError}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Issue Book Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Issue Book to Student</h2>
          <form onSubmit={handleIssueBook} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Select Student *</label>
              <select
                required
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
              >
                <option value="">{loading ? 'Loading active students...' : students.length ? 'Select a student' : 'No active students available'}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.student_id})</option>
                ))}
              </select>
              {!loading && students.length === 0 && <p className="mt-2 text-[11px] text-amber-300">No active student is registered. <Link className="underline" to="/students/new">Register a student</Link>.</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Select Book *</label>
              <select
                required
                value={selectedBook}
                onChange={e => setSelectedBook(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
              >
                <option value="">{loading ? 'Loading available books...' : books.some(book => book.available_copies > 0 && book.status !== 'Discontinued') ? 'Select an available book' : 'No available books in catalogue'}</option>
                {books.filter(book => book.status !== 'Discontinued').map(b => (
                  <option key={b.id} value={b.id} disabled={b.available_copies <= 0}>
                    {b.title} ({b.available_copies} available)
                  </option>
                ))}
              </select>
              {!loading && !books.some(book => book.available_copies > 0 && book.status !== 'Discontinued') && <p className="mt-2 text-[11px] text-amber-300">No available book is in the catalogue. <Link className="underline" to="/books">Add a book</Link>.</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Due Date *</label>
              <input
                type="date"
                required
                min={localDateISO()}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedStudent || !selectedBook}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Issue Book
            </button>
          </form>
        </div>

        {/* Active Issued Books Table */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200">Currently Issued Books ({activeIssues.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Book Title</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeIssues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">No active book issues.</td>
                  </tr>
                ) : (
                  activeIssues.map(issue => (
                    <tr key={issue.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-100">{issue.book?.title}</td>
                      <td className="px-4 py-3 text-cyan-400">{issue.student_name}</td>
                      <td className="px-4 py-3">{issue.issue_date}</td>
                      <td className="px-4 py-3 text-amber-400 font-semibold">{issue.due_date}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReturnBook(issue.id)}
                          className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg text-xs font-medium flex items-center gap-1.5 ml-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Return Book
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
