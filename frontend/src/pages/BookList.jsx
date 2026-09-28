import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Filter, Edit, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import apiClient from '../api/axios';

export const BookList = () => {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State for Adding Book
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBook, setNewBook] = useState({
    isbn: '',
    title: '',
    publisher: '',
    total_copies: 1,
    shelf_location: '',
    description: ''
  });

  const fetchBooks = async () => {
    setLoading(true);
    try {
      let url = '/books?limit=200';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (catFilter) url += `&category_id=${catFilter}`;
      const res = await apiClient.get(url);
      setBooks(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCats = async () => {
    try {
      const res = await apiClient.get('/books/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [search, catFilter]);

  const handleAddBookSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/books', newBook);
      setShowAddModal(false);
      fetchBooks();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not add book');
    }
  };

  const handleDeleteBook = async (id, title) => {
    if (window.confirm(`Discontinue book '${title}'?`)) {
      try {
        await apiClient.delete(`/books/${id}`);
        fetchBooks();
      } catch (e) {
        alert('Failed to discontinue book');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Library Book Catalogue
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage books, inventory stock, editions, and shelf locations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Add New Book
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search book title, ISBN, or publisher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="py-2 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Book Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Book Title</th>
                <th className="px-5 py-3.5">ISBN</th>
                <th className="px-5 py-3.5">Publisher</th>
                <th className="px-5 py-3.5">Total Copies</th>
                <th className="px-5 py-3.5">Available</th>
                <th className="px-5 py-3.5">Shelf Location</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">Loading book inventory...</td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">No books found in library catalogue.</td>
                </tr>
              ) : (
                books.map(b => (
                  <tr key={b.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-100">{b.title}</td>
                    <td className="px-5 py-3.5 font-mono text-cyan-400">{b.isbn}</td>
                    <td className="px-5 py-3.5">{b.publisher || '-'}</td>
                    <td className="px-5 py-3.5 font-semibold">{b.total_copies}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-400">{b.available_copies}</td>
                    <td className="px-5 py-3.5">{b.shelf_location || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        b.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        b.status === 'Out of Stock' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteBook(b.id, b.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-slate-100 pb-2 border-b border-slate-800">Add Book to Library</h2>
            <form onSubmit={handleAddBookSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">ISBN Code *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter ISBN code"
                  value={newBook.isbn}
                  onChange={e => setNewBook({ ...newBook, isbn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Book Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter book title"
                  value={newBook.title}
                  onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Publisher</label>
                  <input
                    type="text"
                    placeholder="Enter publisher"
                    value={newBook.publisher}
                    onChange={e => setNewBook({ ...newBook, publisher: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Total Copies</label>
                  <input
                    type="number"
                    min="1"
                    value={newBook.total_copies}
                    onChange={e => setNewBook({ ...newBook, total_copies: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl"
                >
                  Save Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
