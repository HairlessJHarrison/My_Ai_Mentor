import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function BudgetCard() {
    const { budget } = useHousehold();
    const navigate = useNavigate();
    const categories = budget?.categories || [];
    const totalLimit = budget?.total_limit || 0;
    const totalSpent = budget?.total_spent || 0;
    const remaining = totalLimit - totalSpent;
    const pctUsed = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

    const barColor = pctUsed > 90 ? 'bg-rose-500' : pctUsed > 70 ? 'bg-amber-500' : 'bg-forest-500';

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/budget')}
            style={{ animationDelay: '0.3s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">💰</span> Budget
                </h3>
                {totalLimit > 0 && (
                    <span className="text-xs text-surface-400">{Math.round(pctUsed)}% used</span>
                )}
            </div>

            {totalLimit === 0 ? (
                <p className="text-surface-400 text-sm">No budgets set for this month</p>
            ) : (
                <>
                    {/* Overall progress bar */}
                    <div className="mb-4">
                        <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(pctUsed, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-surface-300">${totalSpent.toFixed(0)} spent</span>
                            <span className={remaining >= 0 ? 'text-forest-400 font-medium' : 'text-rose-400 font-medium'}>
                                ${Math.abs(remaining).toFixed(0)} {remaining >= 0 ? 'left' : 'over'}
                            </span>
                        </div>
                    </div>

                    {/* Top categories */}
                    <div className="space-y-2">
                        {categories.slice(0, 4).map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-surface-300 capitalize">{cat.category}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${cat.pct_used > 90 ? 'bg-rose-500' : 'bg-ocean-400'}`}
                                            style={{ width: `${Math.min(cat.pct_used, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-surface-400 w-10 text-right">{Math.round(cat.pct_used)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
