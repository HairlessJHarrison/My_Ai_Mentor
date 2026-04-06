import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import { AnimatePresence } from 'framer-motion';
import MemberCard from '../components/MemberCard';

function getDeadlineStatus(deadlineStr) {
    if (!deadlineStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr + 'T00:00:00');
    const diffMs = deadline - today;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Overdue', overdue: true };
    if (diffDays === 0) return { label: 'Due today', overdue: false, urgent: true };
    if (diffDays === 1) return { label: '1 day left', overdue: false, urgent: true };
    return { label: `${diffDays} days left`, overdue: false, urgent: diffDays <= 3 };
}

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
    const [editingGoal, setEditingGoal] = useState(null);
    const [expandedGoalId, setExpandedGoalId] = useState(null);
    const [completedTodayIds, setCompletedTodayIds] = useState(new Set());
    const [form, setForm] = useState({
        title: '', category: 'learning', target_frequency: 'daily', points_per_completion: 10, deadline: '',
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
        setCompletedTodayIds(new Set());
        Promise.all([
            get(`/goals?member_id=${selectedMember}`),
            get(`/goals/progress?member_id=${selectedMember}&days=7`),
        ]).then(([g, p]) => {
            setGoals(g);
            setProgress(p.goals || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [selectedMember]);

    const openNewForm = () => {
        setEditingGoal(null);
        setForm({ title: '', category: 'learning', target_frequency: 'daily', points_per_completion: 10, deadline: '' });
        setShowForm(true);
    };

    const openEditForm = (goal) => {
        setEditingGoal(goal);
        setForm({
            title: goal.title,
            category: goal.category,
            target_frequency: goal.target_frequency,
            points_per_completion: goal.points_per_completion,
            deadline: goal.deadline || '',
        });
        setShowForm(true);
    };

    const saveGoal = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: form.title,
                category: form.category,
                target_frequency: form.target_frequency,
                points_per_completion: parseInt(form.points_per_completion),
                deadline: form.deadline || null,
            };
            if (editingGoal) {
                await put(`/goals/${editingGoal.id}`, payload);
            } else {
                await post('/goals', {
                    ...payload,
                    household_id: 'default',
                    member_id: selectedMember,
                });
            }
            const g = await get(`/goals?member_id=${selectedMember}`);
            setGoals(g);
            setShowForm(false);
            setEditingGoal(null);
        } catch (err) { alert(err.message); }
    };

    const completeGoal = async (goalId) => {
        try {
            await post('/goals/complete', { goal_id: goalId, member_id: selectedMember });
            setCompletedTodayIds(prev => new Set([...prev, goalId]));
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

    const selectedMemberData = members.find(m => m.id === selectedMember);
    const memberColor = selectedMemberData?.color;
    const activeGoals = goals.filter(g => g.is_active);
    const doneCount = completedTodayIds.size;
    const totalCount = activeGoals.length;
    const allDone = totalCount > 0 && doneCount >= totalCount;

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🎯 Personal Goals</h1>
                </div>
                <button onClick={openNewForm}
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
                <form onSubmit={saveGoal} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <h3 className="text-base font-semibold text-surface-100">
                        {editingGoal ? 'Edit Goal' : 'New Goal'}
                    </h3>
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
                    <div>
                        <label className="block text-xs text-surface-400 mb-1">Deadline (optional)</label>
                        <input type="date" value={form.deadline}
                            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none w-full md:w-48" />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => { setShowForm(false); setEditingGoal(null); }}
                            className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit"
                            className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
                            {editingGoal ? 'Save Changes' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            )}

            {/* Daily progress counter */}
            {!loading && totalCount > 0 && (
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-sm text-surface-400">
                        <span className="font-semibold text-surface-200">{doneCount}</span>
                        <span> of </span>
                        <span className="font-semibold text-surface-200">{totalCount}</span>
                        <span> done today</span>
                    </span>
                    {/* Progress bar */}
                    <div className="flex-1 mx-4 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
                                backgroundColor: memberColor || 'var(--color-forest-500)',
                            }}
                        />
                    </div>
                    <span className="text-xs font-medium" style={{ color: memberColor || 'var(--color-forest-400)' }}>
                        {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
                    </span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading goals...</div>
            ) : allDone ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">🎉</div>
                    <p className="text-xl font-bold text-surface-100 mb-2">All Done!</p>
                    <p className="text-sm text-surface-400">
                        {selectedMemberData?.name || 'You'} crushed all {totalCount} goal{totalCount === 1 ? '' : 's'} today!
                    </p>
                </div>
            ) : goals.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No goals yet. Create one above!</div>
            ) : (
                <AnimatePresence initial={false}>
                    <div className="space-y-3">
                        {activeGoals.map((goal, index) => {
                            const streak = getStreak(goal.id);
                            const dlStatus = getDeadlineStatus(goal.deadline);
                            const isExpanded = expandedGoalId === goal.id;
                            const isDoneThisSession = completedTodayIds.has(goal.id);
                            return (
                                <MemberCard
                                    key={goal.id}
                                    color={memberColor}
                                    style={{ transitionDelay: `${index * 0.04}s` }}
                                    className={`${dlStatus?.overdue ? 'ring-1 ring-rose-500/40' : ''} ${isDoneThisSession ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-center justify-between px-4 py-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-xl shrink-0">{catEmoji[goal.category] || '⭐'}</span>
                                            <div className="min-w-0">
                                                <p className={`font-medium truncate ${isDoneThisSession ? 'line-through text-surface-400' : 'text-surface-100'}`}>
                                                    {goal.title}
                                                </p>
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-surface-400 mt-0.5">
                                                    <span className="capitalize">{goal.category}</span>
                                                    <span>·</span>
                                                    <span>{goal.target_frequency}</span>
                                                    <span>·</span>
                                                    <span className="text-amber-400">+{goal.points_per_completion} pts</span>
                                                    {dlStatus && (
                                                        <>
                                                            <span>·</span>
                                                            <span className={
                                                                dlStatus.overdue
                                                                    ? 'text-rose-400 font-medium'
                                                                    : dlStatus.urgent
                                                                        ? 'text-amber-400 font-medium'
                                                                        : 'text-surface-400'
                                                            }>
                                                                {dlStatus.overdue && '⚠ '}{dlStatus.label}
                                                            </span>
                                                        </>
                                                    )}
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
                                            <button onClick={() => openEditForm(goal)}
                                                className="p-2 text-surface-400 hover:text-surface-200 transition-colors rounded-lg active:scale-[0.97]"
                                                title="Edit goal">
                                                ✏️
                                            </button>
                                            {!isDoneThisSession && (
                                                <button onClick={() => completeGoal(goal.id)}
                                                    className="px-4 py-2.5 bg-forest-600/20 hover:bg-forest-600 text-forest-400 hover:text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                                                    Done
                                                </button>
                                            )}
                                            {isDoneThisSession && (
                                                <span className="px-4 py-2.5 text-forest-400 text-sm font-medium">✓ Done</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Milestones section */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4">
                                            <MilestoneSection goal={goal} memberId={selectedMember} />
                                        </div>
                                    )}
                                </MemberCard>
                            );
                        })}
                    </div>
                </AnimatePresence>
            )}
        </div>
    );
}
