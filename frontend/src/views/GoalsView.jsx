import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../hooks/useApi';

export default function GoalsView() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [goals, setGoals] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
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
                        return (
                            <div key={goal.id} className="flex items-center justify-between px-5 py-4 bg-surface-800 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{catEmoji[goal.category] || '⭐'}</span>
                                    <div>
                                        <p className="text-surface-100 font-medium">{goal.title}</p>
                                        <div className="flex items-center gap-2 text-sm text-surface-400 mt-0.5">
                                            <span className="capitalize">{goal.category}</span>
                                            <span>·</span>
                                            <span>{goal.target_frequency}</span>
                                            <span>·</span>
                                            <span className="text-amber-400">+{goal.points_per_completion} pts</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {streak > 0 && (
                                        <span className="text-sm text-amber-400 font-medium">
                                            🔥 {streak}d
                                        </span>
                                    )}
                                    <button onClick={() => completeGoal(goal.id)}
                                        className="px-4 py-2.5 bg-forest-600/20 hover:bg-forest-600 text-forest-400 hover:text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                                        Done
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
