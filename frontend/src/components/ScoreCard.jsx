import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function ScoreCard() {
    const { scoring } = useHousehold();
    const navigate = useNavigate();
    const totalPoints = scoring?.total_points || 0;
    const activities = scoring?.activities || [];

    // Simple gauge: map points to 0-100 scale (100pts = full)
    const gaugeMax = 100;
    const gaugePercent = Math.min((totalPoints / gaugeMax) * 100, 100);

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/scoring')}
            style={{ animationDelay: '0.4s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">⭐</span> Presence Score
                </h3>
                <span className="text-xs text-surface-400">Today</span>
            </div>

            {/* Score gauge */}
            <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-surface-700)" strokeWidth="6" />
                        <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="url(#scoreGradient)" strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${gaugePercent * 2.136} 213.6`}
                            className="transition-all duration-700"
                        />
                        <defs>
                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--color-forest-400)" />
                                <stop offset="100%" stopColor="var(--color-amber-400)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-surface-100">
                        {totalPoints}
                    </span>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-surface-300">
                        {activities.length === 0 ? 'No activities logged yet' : `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'} today`}
                    </p>
                    {totalPoints > 0 && (
                        <p className="text-xs text-forest-400 mt-1">
                            {totalPoints >= 50 ? '🌟 Amazing day!' : totalPoints >= 20 ? '✨ Great progress!' : '🌱 Keep going!'}
                        </p>
                    )}
                </div>
            </div>

            {/* Recent activities */}
            {activities.length > 0 && (
                <div className="space-y-1">
                    {activities.slice(-3).map((act, i) => (
                        <div key={act.id || i} className="flex justify-between text-xs px-2 py-1 bg-surface-700/40 rounded-md">
                            <span className="text-surface-300 capitalize">{act.activity_type?.replace(/_/g, ' ')}</span>
                            <span className="text-amber-400">+{act.points_earned} pts</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
