import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, del } from '../hooks/useApi';

function MilestoneSection({ goal, memberId }) {
    const [milestones, setMilestones] = useState([]);
    const [total, setTotal] = useState(0);
    const [completed, setCompleted] = useState(0);
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadMilestones = useCallback(async () => {
        try {
            const data = await get(`/goals/${goal.id}/milestones`);
            setMilestones(data.milestones || []);
            setTotal(data.total || 0);
            setCompleted(data.completed || 0);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [goal.id]);

    useEffect(() => { loadMilestones(); }, [loadMilestones]);

    const addMilestone = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        try {
            await post(`/goals/${goal.id}/milestones`, {
                title: newTitle.trim(),
                order: total,
                points_reward: 0,
            });
            setNewTitle('');
            setAdding(false);
            await loadMilestones();
        } catch (err) { alert(err.message); }
    };

    const completeMilestone = async (milestoneId) => {
        try {
            await post(`/goals/${goal.id}/milestones/${milestoneId}/complete`);
            await loadMilestones();
        } catch (err) { alert(err.message); }
    };

    const deleteMilestone = async (milestoneId) => {
        try {
            await del(`/goals/${goal.id}/milestones/${milestoneId}`);
            await loadMilestones();
        } catch (err) { alert(err.message); }
    };

    return (
        <div className="mt-3 pt-3 border-t border-surface-700/60">
            {/* Progress header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400 font-medium">
                    Milestones
                    {total > 0 && <span className="ml-1.5 text-amber-400">{completed}/{total}</span>}
                </span>
                <button onClick={() => setAdding(a => !a)}
                    className="text-xs text-forest-400 hover:text-forest-300 px-2 py-1 rounded-lg active:scale-[0.97]">
                    + Add
                </button>
            </div>

            {/* Progress bar */}
            {total > 0 && (
                <div className="w-full bg-surface-700 rounded-full h-1 mb-2">
                    <div
                        className="bg-amber-500 h-1 rounded-full transition-all duration-500"
                        style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                    />
                </div>
            )}

            {/* Inline add form */}
            {adding && (
                <form onSubmit={addMilestone} className="flex gap-2 mb-2">
                    <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Milestone title"
                        className="flex-1 bg-surface-700 text-surface-100 rounded-lg px-3 py-1.5 text-xs outline-none"
                    />
                    <button type="submit"
                        className="px-3 py-1.5 bg-forest-600 text-white rounded-lg text-xs font-medium active:scale-[0.97]">
                        Add
                    </button>
                    <button type="button" onClick={() => { setAdding(false); setNewTitle(''); }}
                        className="px-3 py-1.5 bg-surface-700 text-surface-400 rounded-lg text-xs active:scale-[0.97]">
                        ✕
                    </button>
                </form>
            )}

            {/* Milestone list */}
            {loading ? (
                <p className="text-xs text-surface-500">Loading...</p>
            ) : milestones.length === 0 ? (
                <p className="text-xs text-surface-500">No milestones yet.</p>
            ) : (
                <div className="space-y-1">
                    {milestones.map(m => (
                        <div key={m.id} className="flex items-center gap-2 group">
                            <button
                                onClick={() => !m.completed && completeMilestone(m.id)}
                                disabled={m.completed}
                                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                                    m.completed
                                        ? 'bg-forest-500 border-forest-500'
                                        : 'border-surface-500 hover:border-forest-500'
                                }`}
                                title={m.completed ? 'Completed' : 'Mark complete'}
                            >
                                {m.completed && <span className="flex items-center justify-center text-white text-[8px] w-full h-full">✓</span>}
                            </button>
                            <span className={`flex-1 text-xs ${m.completed ? 'line-through text-surface-500' : 'text-surface-300'}`}>
                                {m.title}
                            </span>
                            {m.completed && m.points_reward > 0 && (
                                <span className="text-[10px] text-amber-400">+{m.points_reward}pts</span>
                            )}
                            {!m.completed && (
                                <button
                                    onClick={() => deleteMilestone(m.id)}
                                    className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-rose-400 text-xs transition-opacity px-1 active:scale-[0.97]"
                                    title="Delete milestone"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function GoalsView() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [goals, setGoals] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedGoalId, setExpandedGoalId] = useState(null);
    const [form, setForm] = useState({
        title: '', category: 'learning', target_frequency: 'daily', points_per_completion: 10,
    });

    useEffect(() => {
        get('/members').then(m => {
            setMembers(m);
            if (m.length > 0) setSelectedMember(m[0].id);
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (!selectedMember) return;
        setLoading(true);
        Promise.all([
            get(`/goals?member_id=${selectedMember}`),
            get(`/goals/progress?member_id=${selectedMember}&days=7`),
        ]).then(([g, p]) => {
            setGoals(g);
            setProgress(p.goals || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [selectedMember]);

    const createGoal = async (e) => {
        e.preventDefault();
        try {
            await post('/goals', {
                ...form,
                household_id: 'default',
                member_id: selectedMember,
                points_per_completion: parseInt(form.points_per_completion),
            });
            const g = await get(`/goals?member_id=${selectedMember}`);
            setGoals(g);
            setShowForm(false);
            setForm({ title: '', category: 'learning', target_frequency: 'daily', points_per_completion: 10 });
        } catch (err) { alert(err.message); }
    };

    const completeGoal = async (goalId) => {
        try {
            await post('/goals/complete', { goal_id: goalId, member_id: selectedMember });
            const [g, p] = await Promise.all([
                get(`/goals?member_id=${selectedMember}`),
                get(`/goals/progress?member_id=${selectedMember}&days=7`),
            ]);
            setGoals(g);
            setProgress(p.goals || []);
        } catch (err) { alert(err.message); }
    };

    const getStreak = (goalId) => {
        const pg = progress.find(p => p.goal_id === goalId);
        return pg?.streak || 0;
    };

    const categories = ['learning', 'fitness', 'creativity', 'mindfulness', 'health', 'other'];
    const frequencies = ['daily', 'weekdays', 'weekly', 'custom'];
    const catEmoji = { learning: '📚', fitness: '💪', creativity: '🎨', mindfulness: '🧘', health: '🥗', other: '⭐' };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🎯 Personal Goals</h1>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                    + New Goal
                </button>
            </div>

            {/* Member tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {members.map(m => (
                    <button key={m.id} onClick={() => setSelectedMember(m.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] active:scale-[0.97] ${selectedMember === m.id
                            ? 'bg-forest-600 text-white'
                            : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                        }`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                    </button>
                ))}
            </div>

            {showForm && (
                <form onSubmit={createGoal} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Goal title" required
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {categories.map(c => <option key={c} value={c}>{catEmoji[c]} {c}</option>)}
                        </select>
                        <select value={form.target_frequency} onChange={e => setForm(f => ({ ...f, target_frequency: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input type="number" value={form.points_per_completion}
                            onChange={e => setForm(f => ({ ...f, points_per_completion: e.target.value }))}
                            placeholder="Points" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">Create Goal</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading goals...</div>
            ) : goals.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No goals yet. Create one above!</div>
            ) : (
                <div className="space-y-3">
                    {goals.filter(g => g.is_active).map(goal => {
                        const streak = getStreak(goal.id);
                        const isExpanded = expandedGoalId === goal.id;
                        return (
                            <div key={goal.id} className="bg-surface-800 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl shrink-0">{catEmoji[goal.category] || '⭐'}</span>
                                        <div className="min-w-0">
                                            <p className="text-surface-100 font-medium truncate">{goal.title}</p>
                                            <div className="flex items-center gap-2 text-sm text-surface-400 mt-0.5">
                                                <span className="capitalize">{goal.category}</span>
                                                <span>·</span>
                                                <span>{goal.target_frequency}</span>
                                                <span>·</span>
                                                <span className="text-amber-400">+{goal.points_per_completion} pts</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        {streak > 0 && (
                                            <span className="text-sm text-amber-400 font-medium">
                                                🔥 {streak}d
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                            className={`p-2 rounded-xl text-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.97] ${isExpanded ? 'text-surface-200 bg-surface-700' : 'text-surface-500 hover:text-surface-300'}`}
                                            title="Milestones"
                                        >
                                            ☑
                                        </button>
                                        <button onClick={() => completeGoal(goal.id)}
                                            className="px-4 py-2.5 bg-forest-600/20 hover:bg-forest-600 text-forest-400 hover:text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                                            Done
                                        </button>
                                    </div>
                                </div>

                                {/* Milestones section */}
                                {isExpanded && (
                                    <div className="px-5 pb-4">
                                        <MilestoneSection goal={goal} memberId={selectedMember} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
