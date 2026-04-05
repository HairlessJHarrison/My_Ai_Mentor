import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { get } from '../hooks/useApi';
import { useHousehold } from '../context/HouseholdContext';
import OnboardingWizard from '../components/OnboardingWizard';

const EVENT_TYPE_EMOJI = {
    appointment: '🏥',
    work: '💼',
    school: '🎓',
    social: '🎉',
    errand: '🛒',
    protected_time: '🛡️',
    other: '📌',
};

const CAT_EMOJI = {
    learning: '📚',
    fitness: '💪',
    creativity: '🎨',
    mindfulness: '🧘',
    health: '🥗',
    other: '⭐',
};

function ProgressRing({ percent, color, size = 52 }) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (percent / 100) * circ;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="var(--color-surface-700)" strokeWidth="6"
                />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none"
                    stroke={color || 'var(--color-amber-400)'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: `0 ${circ}` }}
                    animate={{ strokeDasharray: `${dash} ${circ}` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-surface-100">
                {Math.round(percent)}%
            </span>
        </div>
    );
}

function EventRow({ event, members, dim }) {
    const memberColors = (event.assigned_member_ids || [])
        .map(id => members.find(m => m.id === id)?.color)
        .filter(Boolean);

    return (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-opacity ${dim ? 'opacity-40' : ''} ${event.is_protected ? 'bg-forest-900/30 border border-forest-600/20' : 'bg-surface-700/50'}`}>
            <span className="text-surface-400 font-mono text-xs w-[90px] shrink-0">
                {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
            </span>
            <span className="flex-1 truncate text-surface-200">
                {EVENT_TYPE_EMOJI[event.event_type] || '📌'} {event.title}
            </span>
            <div className="flex items-center gap-1 shrink-0">
                {memberColors.slice(0, 3).map((color, i) => (
                    <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                ))}
                {event.is_protected && <span className="text-forest-400 text-xs ml-1">🛡️</span>}
            </div>
        </div>
    );
}

export default function DashboardView() {
    const navigate = useNavigate();
    const { config, members, loading, connected, refresh } = useHousehold();
    const [dashData, setDashData] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });

    useEffect(() => {
        get('/dashboard')
            .then(setDashData)
            .catch(console.error)
            .finally(() => setDataLoading(false));
    }, []);

    const needsOnboarding = !loading && members.length === 0;
    if (needsOnboarding) return <OnboardingWizard onComplete={refresh} />;

    if (loading || dataLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-forest-400/30 border-t-forest-400 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-surface-400 text-sm">Loading today's view...</p>
                </div>
            </div>
        );
    }

    const events = dashData?.schedule?.events || [];
    const freeBlocks = dashData?.schedule?.free_blocks || [];
    const memberStreaks = dashData?.member_streaks || [];
    const achievements = dashData?.achievements || [];

    const sortedEvents = [...events].sort((a, b) =>
        (a.start_time || '').localeCompare(b.start_time || '')
    );
    const now = new Date().toTimeString().slice(0, 5);
    const upcomingEvents = sortedEvents.filter(e => (e.end_time || '23:59') > now);
    const pastEvents = sortedEvents.filter(e => (e.end_time || '23:59') <= now);

    // Only members with at least one active goal
    const membersWithGoals = memberStreaks.filter(
        ({ goals }) => goals.some(g => g.goal.is_active)
    );

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-surface-100">
                            {config?.household_name || 'Today'}
                        </h1>
                        <p className="text-surface-400 text-sm mt-1">{today}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/hub')}
                            className="px-4 py-2.5 bg-surface-700/50 border border-surface-600/50 text-surface-300 hover:bg-surface-700 rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]"
                        >
                            ☰ Hub
                        </button>
                        <button
                            onClick={() => navigate('/settings')}
                            className="p-2.5 bg-surface-700/50 border border-surface-600/50 text-surface-400 hover:text-surface-200 hover:bg-surface-700 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.97]"
                            title="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-forest-400' : 'bg-rose-400'}`} />
                    </div>
                </div>
            </header>

            {/* Today's Schedule */}
            <motion.section
                className="mb-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-surface-200 flex items-center gap-2">
                        📅 Today's Schedule
                        <span className="text-xs font-normal text-surface-500">
                            ({events.length} event{events.length !== 1 ? 's' : ''})
                        </span>
                    </h2>
                    <button
                        onClick={() => navigate('/schedule')}
                        className="text-xs text-forest-400 hover:text-forest-300 transition-colors"
                    >
                        View all →
                    </button>
                </div>

                <div className="bg-surface-800 rounded-2xl p-4">
                    {events.length === 0 ? (
                        <p className="text-surface-500 text-sm text-center py-4">
                            No events today — enjoy the free time!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {upcomingEvents.length > 0 && (
                                <>
                                    {pastEvents.length > 0 && (
                                        <p className="text-xs text-surface-500 uppercase tracking-wider px-1 pb-1">Upcoming</p>
                                    )}
                                    {upcomingEvents.map((event, i) => (
                                        <EventRow key={event.id || i} event={event} members={members} dim={false} />
                                    ))}
                                </>
                            )}
                            {pastEvents.length > 0 && (
                                <>
                                    <p className="text-xs text-surface-500 uppercase tracking-wider px-1 pt-2">Earlier today</p>
                                    {pastEvents.map((event, i) => (
                                        <EventRow key={event.id || i} event={event} members={members} dim={true} />
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {freeBlocks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-surface-700/50">
                            <p className="text-xs text-forest-400 mb-1.5">
                                {freeBlocks.length} free block{freeBlocks.length !== 1 ? 's' : ''} available
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {freeBlocks.slice(0, 3).map((b, i) => (
                                    <span key={i} className="text-xs bg-forest-900/30 text-forest-300 px-2.5 py-1.5 rounded-lg">
                                        {b.start?.slice(0, 5)} – {b.end?.slice(0, 5)} ({b.duration_min}m)
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.section>

            {/* Goal Streaks + Achievement Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Goal Streaks */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-surface-200">
                            🔥 Goal Streaks
                        </h2>
                        <button
                            onClick={() => navigate('/goals')}
                            className="text-xs text-forest-400 hover:text-forest-300 transition-colors"
                        >
                            View all →
                        </button>
                    </div>

                    <div className="space-y-3">
                        {membersWithGoals.length === 0 ? (
                            <div className="bg-surface-800 rounded-2xl p-4">
                                <p className="text-surface-500 text-sm text-center py-2">No active goals yet</p>
                            </div>
                        ) : (
                            membersWithGoals.map(({ member, goals }) => {
                                const activeGoals = goals.filter(g => g.goal.is_active);
                                return (
                                    <div key={member.id} className="bg-surface-800 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: member.color }}
                                            />
                                            <span className="text-sm font-medium text-surface-200">{member.name}</span>
                                            {activeGoals.some(g => g.streak_days > 0) && (
                                                <span className="ml-auto text-xs text-amber-400 font-medium">
                                                    {activeGoals.filter(g => g.streak_days > 0).length} active
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {activeGoals.map(({ goal, streak_days }) => (
                                                <div key={goal.id} className="flex items-center justify-between gap-2">
                                                    <span className={`text-sm truncate ${streak_days > 0 ? 'text-surface-200' : 'text-surface-500'}`}>
                                                        {CAT_EMOJI[goal.category] || '⭐'} {goal.title}
                                                    </span>
                                                    {streak_days > 0 ? (
                                                        <span className="text-sm font-semibold text-amber-400 shrink-0 flex items-center gap-0.5">
                                                            🔥 {streak_days}d
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-surface-600 shrink-0">no streak</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.section>

                {/* Achievement Progress */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-surface-200">
                            🏆 Achievement Progress
                        </h2>
                        <button
                            onClick={() => navigate('/achievements')}
                            className="text-xs text-forest-400 hover:text-forest-300 transition-colors"
                        >
                            View all →
                        </button>
                    </div>

                    <div className="space-y-3">
                        {achievements.length === 0 ? (
                            <div className="bg-surface-800 rounded-2xl p-4">
                                <p className="text-surface-500 text-sm text-center py-2">No active achievements</p>
                            </div>
                        ) : (
                            achievements.map(ach => {
                                const member = members.find(m => m.id === ach.member_id);
                                const pct = ach.percent || 0;
                                const ptsToGo = Math.max(0, ach.target_points - ach.points_earned);
                                return (
                                    <div key={ach.id} className="bg-surface-800 rounded-2xl p-4">
                                        <div className="flex items-center gap-3">
                                            <ProgressRing
                                                percent={pct}
                                                color={member?.color}
                                                size={52}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    {member && (
                                                        <span
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ backgroundColor: member.color }}
                                                        />
                                                    )}
                                                    <span className="text-xs text-surface-400 truncate">
                                                        {member?.name}
                                                    </span>
                                                    {pct >= 100 && (
                                                        <span className="text-xs text-amber-400 ml-auto shrink-0">🎉 Earned!</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-surface-100 truncate">
                                                    {ach.prize_name}
                                                </p>
                                                <p className="text-xs text-surface-500 mt-0.5">
                                                    {ach.points_earned} / {ach.target_points} pts
                                                    {pct < 100 && (
                                                        <span className="text-surface-600 ml-1">({ptsToGo} to go)</span>
                                                    )}
                                                </p>
                                                <div className="mt-2 bg-surface-700 rounded-full h-1.5 overflow-hidden">
                                                    <motion.div
                                                        className="h-1.5 rounded-full"
                                                        style={{ backgroundColor: member?.color || 'var(--color-amber-400)' }}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
