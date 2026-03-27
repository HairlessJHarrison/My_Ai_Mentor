import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';

export default function TodoView() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '', description: '', priority: 'medium', due_date: '', assigned_member_id: '',
    });

    const fetchTodos = () => get('/todos').then(setTodos).catch(console.error);

    useEffect(() => {
        Promise.all([
            get('/members'),
            get('/todos'),
        ]).then(([m, t]) => {
            setMembers(m);
            setTodos(t);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const resetForm = () => {
        setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_member_id: '' });
        setShowForm(false);
        setEditingId(null);
    };

    const submitForm = async (e) => {
        e.preventDefault();
        const payload = {
            household_id: 'default',
            title: form.title,
            description: form.description || null,
            priority: form.priority,
            due_date: form.due_date || null,
            assigned_member_id: form.assigned_member_id ? parseInt(form.assigned_member_id) : null,
        };
        try {
            if (editingId) {
                await put(`/todos/${editingId}`, payload);
            } else {
                await post('/todos', payload);
            }
            await fetchTodos();
            resetForm();
        } catch (err) { alert(err.message); }
    };

    const toggleComplete = async (id) => {
        try {
            await post(`/todos/${id}/complete`);
            await fetchTodos();
        } catch (err) { alert(err.message); }
    };

    const deleteTodo = async (id) => {
        try {
            await del(`/todos/${id}`);
            await fetchTodos();
        } catch (err) { alert(err.message); }
    };

    const startEdit = (todo) => {
        setForm({
            title: todo.title,
            description: todo.description || '',
            priority: todo.priority,
            due_date: todo.due_date || '',
            assigned_member_id: todo.assigned_member_id?.toString() || '',
        });
        setEditingId(todo.id);
        setShowForm(true);
    };

    const getMemberName = (id) => {
        const m = members.find(m => m.id === id);
        return m ? m.name : null;
    };

    const priorityConfig = {
        high:   { emoji: '🔴', label: 'High',   class: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
        medium: { emoji: '🟡', label: 'Medium', class: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
        low:    { emoji: '🟢', label: 'Low',    class: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    };

    const openTodos = todos.filter(t => !t.is_completed);
    const completedTodos = todos.filter(t => t.is_completed);

    // Sort: high → medium → low, then by due date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedOpen = [...openTodos].sort((a, b) => {
        const pd = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
        if (pd !== 0) return pd;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
    });

    const renderTodoItem = (todo, isCompleted = false) => {
        const p = priorityConfig[todo.priority] || priorityConfig.medium;
        const memberName = getMemberName(todo.assigned_member_id);
        const isOverdue = todo.due_date && !todo.is_completed && new Date(todo.due_date + 'T23:59:59') < new Date();

        return (
            <div key={todo.id} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
                isCompleted ? 'bg-surface-800/50' : 'bg-surface-800'
            }`}>
                {/* Checkbox */}
                <button
                    onClick={() => toggleComplete(todo.id)}
                    className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all min-h-[24px] min-w-[24px] active:scale-[0.9] ${
                        isCompleted
                            ? 'bg-forest-600 border-forest-600 text-white'
                            : 'border-surface-500 hover:border-forest-400'
                    }`}
                >
                    {isCompleted && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`font-medium ${isCompleted ? 'text-surface-500 line-through' : 'text-surface-100'}`}>
                        {todo.title}
                    </p>
                    {todo.description && (
                        <p className={`text-sm mt-0.5 ${isCompleted ? 'text-surface-600' : 'text-surface-400'}`}>
                            {todo.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${p.class}`}>
                            {p.emoji} {p.label}
                        </span>
                        {todo.due_date && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                isOverdue
                                    ? 'text-rose-400 bg-rose-400/10 border-rose-400/20'
                                    : 'text-surface-400 bg-surface-700/50 border-surface-600/30'
                            }`}>
                                📅 {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {isOverdue && ' · Overdue'}
                            </span>
                        )}
                        {memberName && (
                            <span className="text-xs px-2 py-0.5 rounded-full text-ocean-400 bg-ocean-400/10 border border-ocean-400/20">
                                👤 {memberName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {!isCompleted && (
                    <div className="flex gap-1 shrink-0">
                        <button
                            onClick={() => startEdit(todo)}
                            className="p-2 text-surface-500 hover:text-surface-200 rounded-lg hover:bg-surface-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-[0.95]"
                            title="Edit"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={() => deleteTodo(todo.id)}
                            className="p-2 text-surface-500 hover:text-rose-400 rounded-lg hover:bg-surface-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-[0.95]"
                            title="Delete"
                        >
                            🗑️
                        </button>
                    </div>
                )}
                {isCompleted && (
                    <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-2 text-surface-500 hover:text-rose-400 rounded-lg hover:bg-surface-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 active:scale-[0.95]"
                        title="Delete"
                    >
                        🗑️
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">✅ To-Do List</h1>
                </div>
                <button onClick={() => { resetForm(); setShowForm(!showForm); }}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                    + New To-Do
                </button>
            </div>

            {/* Create / Edit form */}
            {showForm && (
                <form onSubmit={submitForm} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="What needs to be done?" required autoFocus
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-surface-500" />
                    <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Additional details (optional)"
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-surface-500" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            <option value="low">🟢 Low Priority</option>
                            <option value="medium">🟡 Medium Priority</option>
                            <option value="high">🔴 High Priority</option>
                        </select>
                        <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={form.assigned_member_id} onChange={e => setForm(f => ({ ...f, assigned_member_id: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            <option value="">👤 Unassigned</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
                            {editingId ? 'Save Changes' : 'Add To-Do'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading to-dos...</div>
            ) : sortedOpen.length === 0 && completedTodos.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No to-dos yet. Add one above!</div>
            ) : (
                <>
                    {/* Open items */}
                    {sortedOpen.length === 0 ? (
                        <div className="text-center py-8 text-surface-400">
                            <span className="text-3xl mb-2 block">🎉</span>
                            All caught up! No open to-dos.
                        </div>
                    ) : (
                        <div className="space-y-2 mb-6">
                            {sortedOpen.map(todo => renderTodoItem(todo, false))}
                        </div>
                    )}

                    {/* Completed section */}
                    {completedTodos.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowCompleted(!showCompleted)}
                                className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 mb-3 transition-colors active:scale-[0.98]"
                            >
                                <span className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}>▶</span>
                                Completed ({completedTodos.length})
                            </button>
                            {showCompleted && (
                                <div className="space-y-2">
                                    {completedTodos.map(todo => renderTodoItem(todo, true))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
