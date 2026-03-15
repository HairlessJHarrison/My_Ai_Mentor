import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function GoalCard() {
    const { goals } = useHousehold();
    const navigate = useNavigate();

    const activeGoals = (goals || []).filter(g => g.is_active);
    const totalGoals = activeGoals.length;

    // Simple gauge
    const gaugeMax = Math.max(totalGoals, 1);
    const gaugePercent = totalGoals > 0 ? Math.min((totalGoals / gaugeMax) * 100, 100) : 0;

    const catEmoji = { learning: '📚', fitness: '💪', creativity: '🎨', mindfulness: '🧘', health: '🥗', other: '⭐' };

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/goals')}
            style={{ animationDelay: '0.5s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">🎯</span> Goals
                </h3>
                <span className="text-xs text-surface-400">Active</span>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-surface-700)" strokeWidth="6" />
                        <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="url(#goalGradient)" strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${gaugePercent * 2.136} 213.6`}
                            className="transition-all duration-700"
                        />
                        <defs>
                            <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--color-forest-400)" />
                                <stop offset="100%" stopColor="var(--color-amber-400)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-surface-100">
                        {totalGoals}
                    </span>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-surface-300">
                        {totalGoals === 0 ? 'No goals set yet' : `${totalGoals} active goal${totalGoals === 1 ? '' : 's'}`}
                    </p>
                    {totalGoals > 0 && (
                        <p className="text-xs text-forest-400 mt-1">Tap to track progress</p>
                    )}
                </div>
            </div>

            {activeGoals.length > 0 && (
                <div className="space-y-1.5">
                    {activeGoals.slice(0, 3).map((goal, i) => (
                        <div key={goal.id || i} className="flex justify-between text-sm px-3 py-2.5 bg-surface-700/40 rounded-lg">
                            <span className="text-surface-300">
                                {catEmoji[goal.category] || '⭐'} {goal.title}
                            </span>
                            <span className="text-amber-400">+{goal.points_per_completion} pts</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
