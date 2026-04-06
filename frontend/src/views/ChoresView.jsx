import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import PresetBrowser from '../components/PresetBrowser';
import { CHORE_PRESETS } from '../data/chorePresets';

export default function ChoresView() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [choreStatus, setChoreStatus] = useState({ members: [] });
    const [allChores, setAllChores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const formRef = useRef(null);
    const [form, setForm] = useState({
        title: '', points: 5, frequency: 'daily', assigned_member_ids: [],
    });

    useEffect(() => {
        Promise.all([get('/members'), get('/chores/status'), get('/chores')])
            .then(([m, s, c]) => {
                setMembers(m);
                setChoreStatus(s);
                setAllChores(c);
                if (m.length > 0) setSelectedMember(m[0].id);
            }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const refreshStatus = async () => {
        const s = await get('/chores/status');
        setChoreStatus(s);
    };

    const emptyForm = () => ({ title: '', points: 5, frequency: 'daily', assigned_member_ids: [], schedule_day: null, schedule_week_of_month: null, schedule_anchor_date: null });

    const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    const openNewForm = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
        scrollToForm();
    };

    const openEditForm = (chore) => {
        setEditingId(chore.id);
        setForm({
            title: chore.title,
            points: chore.points,
            frequency: chore.frequency || 'daily',
            assigned_member_ids: chore.assigned_member_ids || [],
            schedule_day: chore.schedule_day ?? null,
            schedule_week_of_month: chore.schedule_week_of_month ?? null,
            schedule_anchor_date: chore.schedule_anchor_date ?? null,
        });
        setShowForm(true);
        scrollToForm();
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
    };

    const submitChore = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                household_id: 'default',
                points: parseInt(form.points),
                assigned_member_ids: form.assigned_member_ids.length > 0 ? form.assigned_member_ids : [],
                schedule_day: form.schedule_day,
                schedule_week_of_month: form.schedule_week_of_month,
                schedule_anchor_date: form.schedule_anchor_date,
            };
            if (editingId) {
                await put(`/chores/${editingId}`, payload);
            } else {
                await post('/chores', payload);
            }
            const [s, c] = await Promise.all([get('/chores/status'), get('/chores')]);
            setChoreStatus(s);
            setAllChores(c);
            closeForm();
        } catch (err) { alert(err.message); }
    };

    const deleteChore = async () => {
        if (!editingId) return;
        if (!confirm('Delete this chore? This cannot be undone.')) return;
        try {
            await del(`/chores/${editingId}`);
            const [s, c] = await Promise.all([get('/chores/status'), get('/chores')]);
            setChoreStatus(s);
            setAllChores(c);
            closeForm();
        } catch (err) { alert(err.message); }
    };

    const completeChore = async (choreId) => {
        try {
            await post('/chores/complete', { chore_id: choreId, member_id: selectedMember });
            await refreshStatus();
        } catch (err) { alert(err.message); }
    };

    const verifyChore = async (completionId) => {
        // Find a parent member for verification
        const parent = members.find(m => m.role === 'parent');
        if (!parent) { alert('No parent member found'); return; }
        try {
            await post(`/chores/verify/${completionId}`, { verified_by: parent.id });
            await refreshStatus();
        } catch (err) { alert(err.message); }
    };

    const memberStatus = choreStatus.members?.find(m => m.member_id === selectedMember);
    const frequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'as_needed'];
    const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', biweekly: 'Every other week', monthly: 'Monthly', as_needed: 'As needed' };
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const OCCURRENCE_LABELS = ['1st', '2nd', '3rd', '4th'];

    const formatSchedule = (chore) => {
        const freq = chore.frequency || 'daily';
        const label = FREQ_LABELS[freq] || freq;
        if (freq === 'daily' || freq === 'as_needed') return label;
        const dayName = chore.schedule_day != null ? DAY_LABELS[chore.schedule_day] : null;
        if (freq === 'weekly') return dayName ? `${label} · ${dayName}` : label;
        if (freq === 'biweekly') return dayName ? `${label} · ${dayName}` : label;
        if (freq === 'monthly') {
            const occ = chore.schedule_week_of_month ? OCCURRENCE_LABELS[chore.schedule_week_of_month - 1] : null;
            return occ && dayName ? `${label} · ${occ} ${dayName}` : label;
        }
        return label;
    };

    const addFromPreset = async (preset) => {
        await post('/chores', {
            household_id: 'default',
            title: preset.title,
            points: preset.points,
            frequency: preset.frequency,
            assigned_member_ids: preset.assigned_member_ids || [],
            schedule_day: preset.frequency === 'weekly' ? 0 : null,
        });
        const [s, c] = await Promise.all([get('/chores/status'), get('/chores')]);
        setChoreStatus(s);
        setAllChores(c);
    };

    const toggleMemberAssignment = (memberId) => {
        setForm(f => {
            const ids = f.assigned_member_ids.includes(memberId)
                ? f.assigned_member_ids.filter(id => id !== memberId)
                : [...f.assigned_member_ids, memberId];
            return { ...f, assigned_member_ids: ids };
        });
    };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🧹 Chore Board</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowPresets(true)}
                        className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        Browse Presets
                    </button>
                    <button onClick={openNewForm}
                        className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        + New Chore
                    </button>
                </div>
            </div>

            {/* Member tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {members.map(m => (
                    <button key={m.id} onClick={() => setSelectedMember(m.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-[48px] active:scale-[0.97] ${selectedMember === m.id
                            ? 'bg-forest-600 text-white'
                            : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                        }`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                    </button>
                ))}
            </div>

            {showForm && (
                <form ref={formRef} onSubmit={submitChore} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <h3 className="text-lg font-semibold text-surface-100">{editingId ? 'Edit Chore' : 'New Chore'}</h3>
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Chore name" required
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                            placeholder="Points" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={form.frequency} onChange={e => {
                                const newFreq = e.target.value;
                                setForm(f => ({
                                    ...f, frequency: newFreq,
                                    schedule_day: (newFreq === 'daily' || newFreq === 'as_needed') ? null : f.schedule_day,
                                    schedule_week_of_month: newFreq === 'monthly' ? (f.schedule_week_of_month || 1) : null,
                                    schedule_anchor_date: newFreq === 'biweekly' ? new Date().toISOString().slice(0, 10) : null,
                                }));
                            }}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {frequencies.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                        </select>
                    </div>
                    {['weekly', 'biweekly', 'monthly'].includes(form.frequency) && (
                        <div>
                            <p className="text-sm text-surface-400 mb-2">Day of week:</p>
                            <div className="flex gap-2 flex-wrap">
                                {DAY_LABELS.map((day, i) => (
                                    <button key={i} type="button" onClick={() => setForm(f => ({ ...f, schedule_day: i }))}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97] ${form.schedule_day === i
                                            ? 'bg-forest-600 text-white'
                                            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                        }`}>
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {form.frequency === 'monthly' && (
                        <div>
                            <p className="text-sm text-surface-400 mb-2">Which occurrence in the month:</p>
                            <div className="flex gap-2">
                                {OCCURRENCE_LABELS.map((label, i) => (
                                    <button key={i} type="button" onClick={() => setForm(f => ({ ...f, schedule_week_of_month: i + 1 }))}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97] ${form.schedule_week_of_month === i + 1
                                            ? 'bg-forest-600 text-white'
                                            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                        }`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="text-sm text-surface-400 mb-2">Assign to (leave empty for everyone):</p>
                        <div className="flex gap-2 flex-wrap">
                            {members.map(m => (
                                <button key={m.id} type="button" onClick={() => toggleMemberAssignment(m.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[48px] active:scale-[0.97] ${form.assigned_member_ids.includes(m.id)
                                        ? 'bg-forest-600 text-white'
                                        : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                    }`}>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        {editingId && (
                            <button type="button" onClick={deleteChore}
                                className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-xl text-sm font-medium transition-colors mr-auto min-h-[48px] active:scale-[0.97]">
                                Delete
                            </button>
                        )}
                        <button type="button" onClick={closeForm} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                            {editingId ? 'Save Changes' : 'Create Chore'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading chores...</div>
            ) : !memberStatus || memberStatus.chores.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No chores assigned. Create one above!</div>
            ) : (
                <>
                    {/* Progress summary */}
                    <div className="bg-surface-800 rounded-2xl p-6 mb-6 text-center">
                        <p className="text-surface-400 text-sm mb-1">Today's Progress</p>
                        <p className="text-3xl font-bold text-surface-100 mb-1">
                            {memberStatus.chores.filter(c => c.completed).length} / {memberStatus.chores.length}
                        </p>
                        <p className="text-sm text-surface-400">chores completed</p>
                    </div>

                    <div className="space-y-2">
                        {memberStatus.chores.map((item, i) => (
                            <div key={item.chore.id || i}
                                className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-colors ${item.completed ? 'bg-surface-800/60' : 'bg-surface-800'}`}>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => !item.completed && completeChore(item.chore.id)}
                                        className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-colors active:scale-[0.95] ${item.completed
                                            ? 'bg-forest-600 border-forest-600 text-white'
                                            : 'border-surface-500 hover:border-forest-400'
                                        }`}>
                                        {item.completed && <span className="text-sm">✓</span>}
                                    </button>
                                    <div>
                                        <p className={`font-medium ${item.completed ? 'text-surface-500 line-through' : 'text-surface-100'}`}>
                                            {item.chore.title}
                                        </p>
                                        <p className="text-sm text-surface-400">
                                            <span className="text-amber-400">+{item.chore.points} pts</span>
                                            <span className="mx-1">·</span>
                                            <span>{formatSchedule(item.chore)}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openEditForm(item.chore)}
                                        className="px-4 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-surface-100 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                                        Edit
                                    </button>
                                    {item.completed && !item.verified_by && (
                                        <button onClick={() => verifyChore(item.chore.id)}
                                            className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                                            Verify
                                        </button>
                                    )}
                                    {item.completed && item.verified_by && (
                                        <span className="text-sm text-forest-400 font-medium">✓ Verified</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {showPresets && (
                <PresetBrowser type="chore" presets={CHORE_PRESETS} members={members}
                    onAdd={addFromPreset} onClose={() => setShowPresets(false)} />
            )}
        </div>
    );
}
