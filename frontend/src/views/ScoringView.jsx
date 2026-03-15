import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../hooks/useApi';

export default function ScoringView() {
    const navigate = useNavigate();
    const [today, setToday] = useState({ activities: [], total_points: 0 });
    const [trends, setTrends] = useState([]);
    const [streaks, setStreaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        activity_type: 'screen_free_family', duration_min: 30, participants_count: 2,
    });

    useEffect(() => {
        Promise.all([
            get('/scoring/today'),
            get('/scoring/trends?weeks=4'),
            get('/scoring/streaks'),
        ]).then(([t, tr, s]) => { setToday(t); setTrends(tr.weeks || []); setStreaks(s.streaks || []); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const logActivity = async (e) => {
        e.preventDefault();
        try {
            await post('/scoring/log-activity', {
                ...form,
                duration_min: parseInt(form.duration_min),
                participants_count: parseInt(form.participants_count),
            });
            const [t, s] = await Promise.all([get('/scoring/today'), get('/scoring/streaks')]);
            setToday(t); setStreaks(s.streaks || []);
            setShowForm(false);
        } catch (err) { alert(err.message); }
    };

    const activityTypes = ['screen_free_family', 'outdoor', 'shared_meal', 'game_creative', 'one_on_one', 'other'];
    const typeEmoji = { screen_free_family: '📵', outdoor: '🌳', shared_meal: '🍳', game_creative: '🎨', one_on_one: '💛', other: '⭐' };

    const maxTrendPoints = Math.max(...trends.map(t => t.total_points), 1);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">⭐ Presence Score</h1>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                    + Log Activity
                </button>
            </div>

            {/* Today summary */}
            <div className="bg-surface-800 rounded-2xl p-6 mb-6 text-center">
                <p className="text-surface-400 text-sm mb-1">Today's Points</p>
                <p className="text-5xl font-bold text-amber-400 mb-2">{today.total_points}</p>
                <p className="text-sm text-surface-400">{today.activities?.length || 0} activities logged</p>
            </div>

            {showForm && (
                <form onSubmit={logActivity} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {activityTypes.map(t => (
                                <option key={t} value={t}>{typeEmoji[t]} {t.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                        <input type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                            placeholder="Duration (min)" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <input type="number" value={form.participants_count} onChange={e => setForm(f => ({ ...f, participants_count: e.target.value }))}
                            placeholder="Participants" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">Log Activity</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading scores...</div>
            ) : (
                <>
                    {/* Weekly trends */}
                    {trends.length > 0 && (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                            <h2 className="text-lg font-semibold text-surface-100 mb-4">Weekly Trends</h2>
                            <div className="flex items-end gap-3 h-32">
                                {trends.map((week, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs text-amber-400 font-medium">{week.total_points}</span>
                                        <div className="w-full bg-surface-700 rounded-t-lg overflow-hidden" style={{ height: '100px' }}>
                                            <div
                                                className="w-full bg-gradient-to-t from-forest-600 to-amber-500 rounded-t-lg transition-all duration-500"
                                                style={{ height: `${(week.total_points / maxTrendPoints) * 100}%`, marginTop: `${100 - (week.total_points / maxTrendPoints) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-surface-500 truncate w-full text-center">
                                            {week.week_start?.slice(5)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Streaks */}
                    {streaks.length > 0 && (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                            <h2 className="text-lg font-semibold text-surface-100 mb-3">🔥 Active Streaks</h2>
                            <div className="space-y-2">
                                {streaks.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-3 bg-surface-700/40 rounded-xl text-sm">
                                        <span className="text-surface-200 capitalize">{s.activity_type?.replace(/_/g, ' ')}</span>
                                        <span className="text-amber-400 font-medium">{s.consecutive_days} days · +{s.points_bonus} bonus</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Today's activities */}
                    <h2 className="text-lg font-semibold text-surface-100 mb-3">Today's Activities</h2>
                    <div className="space-y-2">
                        {today.activities?.length === 0 ? (
                            <div className="text-center py-8 text-surface-400">No activities today. Log one above!</div>
                        ) : today.activities?.map((act, i) => (
                            <div key={act.id || i} className="flex items-center justify-between px-4 py-3 bg-surface-800 rounded-xl text-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{typeEmoji[act.activity_type] || '⭐'}</span>
                                    <div>
                                        <p className="text-surface-200 capitalize">{act.activity_type?.replace(/_/g, ' ')}</p>
                                        <p className="text-sm text-surface-400">{act.duration_min}m · {act.participants_count} participant(s)</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-amber-400 font-medium">+{act.points_earned} pts</p>
                                    {act.multipliers_applied?.length > 0 && (
                                        <p className="text-xs text-forest-400">{act.multipliers_applied.join(', ')}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
