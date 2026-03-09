import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../hooks/useApi';

export default function ChoresView() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [choreStatus, setChoreStatus] = useState({ members: [] });
    const [allChores, setAllChores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
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

    const createChore = async (e) => {
        e.preventDefault();
        try {
            await post('/chores', {
                ...form,
                household_id: 'default',
                points: parseInt(form.points),
                assigned_member_ids: form.assigned_member_ids.length > 0 ? form.assigned_member_ids : [],
            });
            const [s, c] = await Promise.all([get('/chores/status'), get('/chores')]);
            setChoreStatus(s);
            setAllChores(c);
            setShowForm(false);
            setForm({ title: '', points: 5, frequency: 'daily', assigned_member_ids: [] });
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
    const frequencies = ['daily', 'weekly', 'as_needed'];

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
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🧹 Chore Board</h1>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors">
                    + New Chore
                </button>
            </div>

            {/* Member tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {members.map(m => (
                    <button key={m.id} onClick={() => setSelectedMember(m.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${selectedMember === m.id
                            ? 'bg-forest-600 text-white'
                            : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                        }`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                    </button>
                ))}
            </div>

            {showForm && (
                <form onSubmit={createChore} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Chore name" required
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                            placeholder="Points" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {frequencies.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div>
                        <p className="text-sm text-surface-400 mb-2">Assign to (leave empty for everyone):</p>
                        <div className="flex gap-2 flex-wrap">
                            {members.map(m => (
                                <button key={m.id} type="button" onClick={() => toggleMemberAssignment(m.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${form.assigned_member_ids.includes(m.id)
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
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium">Create Chore</button>
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
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${item.completed
                                            ? 'bg-forest-600 border-forest-600 text-white'
                                            : 'border-surface-500 hover:border-forest-400'
                                        }`}>
                                        {item.completed && <span className="text-xs">✓</span>}
                                    </button>
                                    <div>
                                        <p className={`font-medium ${item.completed ? 'text-surface-500 line-through' : 'text-surface-100'}`}>
                                            {item.chore.title}
                                        </p>
                                        <p className="text-xs text-surface-400">
                                            <span className="text-amber-400">+{item.chore.points} pts</span>
                                            <span className="mx-1">·</span>
                                            <span>{item.chore.frequency?.replace(/_/g, ' ')}</span>
                                        </p>
                                    </div>
                                </div>
                                {item.completed && !item.verified_by && (
                                    <button onClick={() => verifyChore(item.chore.id)}
                                        className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-xs font-medium transition-colors">
                                        Verify
                                    </button>
                                )}
                                {item.completed && item.verified_by && (
                                    <span className="text-xs text-forest-400 font-medium">✓ Verified</span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
