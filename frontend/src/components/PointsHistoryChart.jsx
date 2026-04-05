import { useState, useEffect } from 'react';
import { get } from '../hooks/useApi';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    Tooltip, Legend, CartesianGrid,
} from 'recharts';

const RANGE_OPTIONS = [
    { label: '2 weeks', days: 14 },
    { label: '30 days', days: 30 },
    { label: '60 days', days: 60 },
];

function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const goal = payload.find(p => p.dataKey === 'goal_points');
    const chore = payload.find(p => p.dataKey === 'chore_points');
    const total = (goal?.value || 0) + (chore?.value || 0);
    return (
        <div className="bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-xs shadow-xl">
            <p className="text-surface-300 font-medium mb-1">{formatDateLabel(label)}</p>
            {goal?.value > 0 && <p className="text-forest-400">Goals: +{goal.value} pts</p>}
            {chore?.value > 0 && <p className="text-amber-400">Chores: +{chore.value} pts</p>}
            {total > 0 && <p className="text-surface-100 font-semibold mt-1">Total: {total} pts</p>}
            {total === 0 && <p className="text-surface-500">No points</p>}
        </div>
    );
};

export default function PointsHistoryChart({ memberId }) {
    const [data, setData] = useState([]);
    const [days, setDays] = useState(14);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!memberId) return;
        setLoading(true);
        get(`/goals/points-history?member_id=${memberId}&days=${days}`)
            .then(res => setData(res.days || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [memberId, days]);

    const hasAnyPoints = data.some(d => d.total > 0);

    // Thin out x-axis labels to avoid crowding
    const tickInterval = days <= 14 ? 1 : days <= 30 ? 4 : 6;

    return (
        <div className="bg-surface-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-surface-100 font-semibold text-sm">Points History</h3>
                <div className="flex gap-1">
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.days}
                            onClick={() => setDays(opt.days)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${days === opt.days
                                ? 'bg-forest-600 text-white'
                                : 'bg-surface-700 text-surface-400 hover:text-surface-200'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="h-48 flex items-center justify-center text-surface-500 text-sm">Loading...</div>
            ) : !hasAnyPoints ? (
                <div className="h-48 flex items-center justify-center text-surface-500 text-sm">
                    No points earned in this period yet.
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={days <= 14 ? 16 : 8}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDateLabel}
                            interval={tickInterval}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                            formatter={(value) => value === 'goal_points' ? 'Goals' : 'Chores'}
                        />
                        <Bar dataKey="goal_points" stackId="pts" fill="var(--color-forest-500, #22c55e)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="chore_points" stackId="pts" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
