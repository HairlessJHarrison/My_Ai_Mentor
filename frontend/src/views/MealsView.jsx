import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, del } from '../hooks/useApi';

export default function MealsView() {
    const navigate = useNavigate();
    const [meals, setMeals] = useState({ meals: [], total_cost: 0, avg_health_score: 0 });
    const [grocery, setGrocery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showGrocery, setShowGrocery] = useState(false);
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10), meal_type: 'dinner',
        recipe_name: '', ingredients: '', est_cost: '', health_score: 7,
        prep_time_min: 30, household_id: 'default',
    });

    useEffect(() => {
        get('/meals/plan?week=current').then(setMeals).catch(console.error).finally(() => setLoading(false));
    }, []);

    const loadGrocery = async () => {
        try {
            const data = await get('/meals/grocery-list?week=current');
            setGrocery(data);
            setShowGrocery(true);
        } catch (e) { console.error(e); }
    };

    const createMeal = async (e) => {
        e.preventDefault();
        try {
            await post('/meals/plan', {
                ...form,
                ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
                est_cost: parseFloat(form.est_cost) || 0,
                health_score: parseInt(form.health_score),
                prep_time_min: parseInt(form.prep_time_min),
            });
            const updated = await get('/meals/plan?week=current');
            setMeals(updated);
            setShowForm(false);
        } catch (err) { alert(err.message); }
    };

    const deleteMeal = async (id) => {
        if (!confirm('Delete this meal?')) return;
        await del(`/meals/plan/${id}`);
        setMeals(prev => ({ ...prev, meals: prev.meals.filter(m => m.id !== id) }));
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const typeEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🍽️ Meal Plans</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadGrocery}
                        className="px-4 py-2 bg-amber-600/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/30 rounded-xl text-sm font-medium transition-colors">
                        🛒 Grocery List
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors">
                        + Add Meal
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            <div className="flex gap-4 mb-6 text-sm">
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-xs">Weekly Cost</p>
                    <p className="text-amber-300 font-semibold">${meals.total_cost?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-xs">Avg Health</p>
                    <p className="text-forest-300 font-semibold">{meals.avg_health_score || 0}/10</p>
                </div>
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-xs">Meals Planned</p>
                    <p className="text-ocean-300 font-semibold">{meals.meals?.length || 0}</p>
                </div>
            </div>

            {showForm && (
                <form onSubmit={createMeal} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.recipe_name} onChange={e => setForm(f => ({ ...f, recipe_name: e.target.value }))}
                            placeholder="Recipe name" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        <select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {mealTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <input value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                            placeholder="Ingredients (comma separated)"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <input type="number" value={form.est_cost} onChange={e => setForm(f => ({ ...f, est_cost: e.target.value }))}
                            placeholder="Est. cost ($)" step="0.01"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <div className="flex gap-2">
                            <input type="number" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: e.target.value }))}
                                min="1" max="10" placeholder="Health (1-10)"
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            <input type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))}
                                placeholder="Prep (min)"
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium">Create</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading meals...</div>
            ) : (
                <div className="space-y-3">
                    {meals.meals?.length === 0 ? (
                        <div className="text-center py-12 text-surface-400">No meals planned. Add one above!</div>
                    ) : meals.meals.map((meal) => (
                        <div key={meal.id} className="flex items-center gap-4 px-5 py-4 bg-surface-800 rounded-xl">
                            <span className="text-xl">{typeEmoji[meal.meal_type] || '🍽️'}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-surface-100 truncate">{meal.recipe_name}</p>
                                <p className="text-xs text-surface-400">
                                    {meal.date} · {meal.meal_type} · {meal.prep_time_min}m prep
                                    <span className="ml-2 text-amber-400">${meal.est_cost?.toFixed(2)}</span>
                                </p>
                            </div>
                            <span className="text-xs text-forest-400 font-medium">{meal.health_score}/10</span>
                            <button onClick={() => deleteMeal(meal.id)} className="text-surface-500 hover:text-rose-400 text-sm">✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Grocery list modal */}
            {showGrocery && grocery && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGrocery(false)}>
                    <div className="bg-surface-800 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-surface-100 mb-4">🛒 Grocery List</h2>
                        {grocery.items?.length === 0 ? (
                            <p className="text-surface-400">No items — add meal plans first</p>
                        ) : (
                            <div className="space-y-2">
                                {grocery.items.map((item, i) => (
                                    <div key={i} className="flex justify-between px-3 py-2 bg-surface-700/60 rounded-lg text-sm">
                                        <span className="text-surface-200">{item.ingredient}</span>
                                        <span className="text-amber-400">${item.est_cost?.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-surface-700 flex justify-between font-medium">
                            <span className="text-surface-200">Total</span>
                            <span className="text-amber-300">${grocery.total_est_cost?.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
