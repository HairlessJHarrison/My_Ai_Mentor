import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../hooks/useApi';
import { useHousehold } from '../context/HouseholdContext';

export default function ReflectionView() {
    const navigate = useNavigate();
    const { config, members } = useHousehold();
    const [trends, setTrends] = useState([]);
    const [memberScores, setMemberScores] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [trendData, ...scores] = await Promise.all([
                    get('/scoring/trends?weeks=4'),
                    ...members.map(m => get(`/members/${m.id}/score?period=week`)),
                ]);
                setTrends(trendData.weeks || []);
                setMemberScores(scores);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        if (members.length > 0) load();
        else setLoading(false);
    }, [members]);

    const currentWeek = trends[0] || {};
    const lastWeek = trends[1] || {};
    const pointsDiff = currentWeek.total_points - (lastWeek.total_points || 0);
    const narrative = config?.weekly_reflection_narrative;

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                <h1 className="text-2xl font-bold text-surface-100">📝 Weekly Reflection</h1>
            </div>

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading reflection...</div>
            ) : (
                <>
                    {/* Weekly Narrative from OpenClaw */}
                    {narrative ? (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6 border border-surface-700/50">
                            <h2 className="text-lg font-semibold text-surface-100 mb-3 flex items-center gap-2">
                                <span className="text-xl">💬</span> This Week's Reflection
                            </h2>
                            <p className="text-surface-300 leading-relaxed italic text-sm">
                                "{narrative}"
                            </p>
                        </div>
                    ) : (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6 text-center">
                            <p className="text-surface-400 text-sm">
                                No reflection yet. OpenClaw writes a weekly narrative based on your family's activity.
                            </p>
                        </div>
                    )}

                    {/* Week-over-Week Comparison */}
                    <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                        <h2 className="text-lg font-semibold text-surface-100 mb-4">📊 Week-over-Week</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface-700/40 rounded-xl p-4 text-center">
                                <p className="text-sm text-surface-400 mb-1">This Week</p>
                                <p className="text-3xl font-bold text-amber-400">{currentWeek.total_points || 0}</p>
                                <p className="text-xs text-surface-500 mt-1">{currentWeek.activity_count || 0} activities</p>
                            </div>
                            <div className="bg-surface-700/40 rounded-xl p-4 text-center">
                                <p className="text-sm text-surface-400 mb-1">Last Week</p>
                                <p className="text-3xl font-bold text-surface-300">{lastWeek.total_points || 0}</p>
                                <p className="text-xs text-surface-500 mt-1">{lastWeek.activity_count || 0} activities</p>
                            </div>
                        </div>
                        {pointsDiff !== 0 && (
                            <div className={`mt-3 text-center text-sm font-medium ${pointsDiff > 0 ? 'text-forest-400' : 'text-rose-400'}`}>
                                {pointsDiff > 0 ? '↑' : '↓'} {Math.abs(pointsDiff)} points {pointsDiff > 0 ? 'more' : 'fewer'} than last week
                            </div>
                        )}
                    </div>

                    {/* Per-Member Scores */}
                    {memberScores.length > 0 && (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                            <h2 className="text-lg font-semibold text-surface-100 mb-4">👨‍👩‍👧‍👦 Family Progress</h2>
                            <div className="space-y-3">
                                {memberScores.map((score) => {
                                    const member = members.find(m => m.id === score.member_id);
                                    const maxPoints = Math.max(...memberScores.map(s => s.total_points), 1);
                                    return (
                                        <div key={score.member_id} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                style={{ backgroundColor: member?.color || '#22c55e' }}>
                                                {member?.name?.[0] || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm text-surface-200 truncate">{score.member_name}</span>
                                                    <span className="text-sm text-amber-400 font-medium shrink-0">{score.total_points} pts</span>
                                                </div>
                                                <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-forest-600 to-amber-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${(score.total_points / maxPoints) * 100}%` }} />
                                                </div>
                                                <div className="flex gap-3 mt-1 text-xs text-surface-500">
                                                    <span>Activities: {score.breakdown?.activities || 0}</span>
                                                    <span>Goals: {score.breakdown?.goals || 0}</span>
                                                    <span>Chores: {score.breakdown?.chores || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Trend Sparkline */}
                    {trends.length > 0 && (
                        <div className="bg-surface-800 rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-surface-100 mb-4">📈 4-Week Trend</h2>
                            <div className="flex items-end gap-3 h-24">
                                {[...trends].reverse().map((week, i) => {
                                    const maxPts = Math.max(...trends.map(t => t.total_points), 1);
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-xs text-amber-400 font-medium">{week.total_points}</span>
                                            <div className="w-full bg-surface-700 rounded-t-lg" style={{ height: '72px' }}>
                                                <div className="w-full bg-gradient-to-t from-forest-600 to-amber-500 rounded-t-lg transition-all duration-500"
                                                    style={{ height: `${(week.total_points / maxPts) * 100}%`, marginTop: `${100 - (week.total_points / maxPts) * 100}%` }} />
                                            </div>
                                            <span className="text-xs text-surface-500">{week.week_start?.slice(5)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
