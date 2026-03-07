import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function MealCard() {
    const { meals } = useHousehold();
    const navigate = useNavigate();
    const mealList = meals?.meals || [];

    const healthBadge = (score) => {
        if (score >= 8) return { color: 'text-forest-400', label: 'Excellent' };
        if (score >= 5) return { color: 'text-amber-400', label: 'Good' };
        return { color: 'text-rose-400', label: 'Fair' };
    };

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/meals')}
            style={{ animationDelay: '0.2s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">🍽️</span> Meals
                </h3>
                {meals?.avg_health_score > 0 && (
                    <span className={`text-xs font-medium ${healthBadge(meals.avg_health_score).color}`}>
                        Health: {meals.avg_health_score}/10
                    </span>
                )}
            </div>

            {mealList.length === 0 ? (
                <p className="text-surface-400 text-sm">No meals planned this week</p>
            ) : (
                <div className="space-y-2">
                    {mealList.slice(0, 4).map((meal, i) => (
                        <div key={meal.id || i} className="flex items-center justify-between px-3 py-2 bg-surface-700/60 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-400 uppercase font-medium w-14">{meal.meal_type}</span>
                                <span className="truncate">{meal.recipe_name}</span>
                            </div>
                            <span className="text-xs text-surface-400">{meal.prep_time_min}m</span>
                        </div>
                    ))}
                </div>
            )}

            {meals?.total_cost > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-700 flex justify-between text-xs">
                    <span className="text-surface-400">Week total</span>
                    <span className="text-amber-300 font-medium">${meals.total_cost.toFixed(2)}</span>
                </div>
            )}
        </div>
    );
}
