import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import PresetBrowser from '../components/PresetBrowser';
import { MEAL_PRESETS } from '../data/mealPresets';

const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10), meal_type: 'dinner',
    recipe_name: '', ingredients: '', est_cost: '', health_score: 7,
    prep_time_min: 30, household_id: 'default', recipe_id: null,
});

export default function MealsView() {
    const navigate = useNavigate();
    const [meals, setMeals] = useState({ meals: [], total_cost: 0, avg_health_score: 0 });
    const [grocery, setGrocery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showPresets, setShowPresets] = useState(false);
    const [showGrocery, setShowGrocery] = useState(false);
    const [showRecipePicker, setShowRecipePicker] = useState(false);
    const [savedRecipes, setSavedRecipes] = useState([]);
    const [members, setMembers] = useState([]);
    const formRef = useRef(null);
    const [form, setForm] = useState(emptyForm());

    useEffect(() => {
        Promise.all([get('/meals/plan?week=current'), get('/members'), get('/recipes')])
            .then(([m, mem, recs]) => { setMeals(m); setMembers(mem); setSavedRecipes(recs); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    const openNewForm = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
        scrollToForm();
    };

    const openEditForm = (meal) => {
        setEditingId(meal.id);
        setForm({
            date: meal.date || new Date().toISOString().slice(0, 10),
            meal_type: meal.meal_type || 'dinner',
            recipe_name: meal.recipe_name || '',
            ingredients: (meal.ingredients || []).join(', '),
            est_cost: meal.est_cost ?? '',
            health_score: meal.health_score ?? 7,
            prep_time_min: meal.prep_time_min ?? 30,
            household_id: meal.household_id || 'default',
            recipe_id: meal.recipe_id || null,
        });
        setShowForm(true);
        scrollToForm();
    };

    const pickRecipe = (recipe) => {
        setForm(f => ({
            ...f,
            recipe_name: recipe.name,
            ingredients: (recipe.ingredients || []).map(i => `${i.quantity}${i.unit ? ' ' + i.unit : ''} ${i.ingredient_name}`).join(', '),
            prep_time_min: (recipe.prep_time_min || 0) + (recipe.cook_time_min || 0) || f.prep_time_min,
            meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(recipe.category) ? recipe.category : f.meal_type,
            recipe_id: recipe.id,
        }));
        setShowRecipePicker(false);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
    };

    const loadGrocery = async () => {
        try {
            const data = await get('/meals/grocery-list?week=current');
            setGrocery(data);
            setShowGrocery(true);
        } catch (e) { console.error(e); }
    };

    const submitForm = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
                est_cost: parseFloat(form.est_cost) || 0,
                health_score: parseInt(form.health_score),
                prep_time_min: parseInt(form.prep_time_min),
                recipe_id: form.recipe_id || null,
            };
            if (editingId) {
                await put(`/meals/plan/${editingId}`, payload);
            } else {
                await post('/meals/plan', payload);
            }
            const updated = await get('/meals/plan?week=current');
            setMeals(updated);
            closeForm();
        } catch (err) { alert(err.message); }
    };

    const addFromPreset = async (preset) => {
        await post('/meals/plan', {
            household_id: 'default',
            date: preset.date || new Date().toISOString().slice(0, 10),
            meal_type: preset.meal_type,
            recipe_name: preset.recipe_name,
            ingredients: Array.isArray(preset.ingredients) ? preset.ingredients : preset.ingredients.split(',').map(s => s.trim()),
            est_cost: parseFloat(preset.est_cost) || 0,
            health_score: parseInt(preset.health_score),
            prep_time_min: parseInt(preset.prep_time_min),
        });
        const updated = await get('/meals/plan?week=current');
        setMeals(updated);
    };

    const deleteMeal = async (id) => {
        if (!confirm('Delete this meal?')) return;
        await del(`/meals/plan/${id}`);
        setMeals(prev => ({ ...prev, meals: prev.meals.filter(m => m.id !== id) }));
        if (editingId === id) closeForm();
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const typeEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🍽️ Meal Plans</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadGrocery}
                        className="px-4 py-2.5 bg-amber-600/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        🛒 Grocery List
                    </button>
                    <button onClick={() => setShowPresets(true)}
                        className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        Browse Presets
                    </button>
                    <button onClick={openNewForm}
                        className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        + Add Meal
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            <div className="flex gap-4 mb-6 text-sm">
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-sm">Weekly Cost</p>
                    <p className="text-amber-300 font-semibold">${meals.total_cost?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-sm">Avg Health</p>
                    <p className="text-forest-300 font-semibold">{meals.avg_health_score || 0}/10</p>
                </div>
                <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                    <p className="text-surface-400 text-sm">Meals Planned</p>
                    <p className="text-ocean-300 font-semibold">{meals.meals?.length || 0}</p>
                </div>
            </div>

            {showForm && (
                <form ref={formRef} onSubmit={submitForm} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-surface-300">
                            {editingId ? 'Edit Meal' : 'New Meal'}
                        </p>
                        {savedRecipes.length > 0 && (
                            <button type="button" onClick={() => setShowRecipePicker(true)}
                                className="px-3 py-1.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-xs font-medium transition-colors active:scale-[0.97]">
                                📖 Pick from Recipes
                            </button>
                        )}
                    </div>
                    {form.recipe_id && (
                        <p className="text-xs text-forest-400">
                            📖 Linked to recipe · <button type="button" onClick={() => setForm(f => ({ ...f, recipe_id: null }))} className="underline text-surface-400 hover:text-surface-200">Unlink</button>
                        </p>
                    )}
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
                            <div className="flex-1">
                                <label className="block text-xs text-surface-400 mb-1">Health Score (1-10)</label>
                                <input type="number" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: e.target.value }))}
                                    min="1" max="10"
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-surface-400 mb-1">Prep Time (minutes)</label>
                                <input type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))}
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={closeForm} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">Cancel</button>
                        {editingId && (
                            <button type="button" onClick={() => deleteMeal(editingId)}
                                className="px-4 py-2.5 bg-rose-600/20 border border-rose-600/30 text-rose-300 hover:bg-rose-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                                Delete
                            </button>
                        )}
                        <button type="submit"
                            className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                            {editingId ? 'Save Changes' : 'Create'}
                        </button>
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
                        <div key={meal.id}
                            onClick={() => openEditForm(meal)}
                            className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-colors cursor-pointer
                                ${editingId === meal.id ? 'ring-2 ring-forest-500 bg-surface-800' : 'bg-surface-800 hover:bg-surface-750'}`}>
                            <span className="text-xl">{typeEmoji[meal.meal_type] || '🍽️'}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-surface-100 truncate">{meal.recipe_name}</p>
                                <p className="text-sm text-surface-400">
                                    {meal.date} · {meal.meal_type} · {meal.prep_time_min}m prep
                                    <span className="ml-2 text-amber-400">${meal.est_cost?.toFixed(2)}</span>
                                </p>
                            </div>
                            <span className="text-xs text-forest-400 font-medium">{meal.health_score}/10</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}
                                className="text-surface-500 hover:text-rose-400 transition-colors text-sm w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-700/50 active:scale-[0.95]">✕</button>
                        </div>
                    ))}
                </div>
            )}

            {showPresets && (
                <PresetBrowser type="meal" presets={MEAL_PRESETS} members={members}
                    onAdd={addFromPreset} onClose={() => setShowPresets(false)} />
            )}

            {/* Recipe picker modal */}
            {showRecipePicker && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowRecipePicker(false)}>
                    <div className="bg-surface-800 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-surface-100 mb-4">📖 Pick a Recipe</h2>
                        {savedRecipes.length === 0 ? (
                            <p className="text-surface-400 text-sm">No saved recipes yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {savedRecipes.map(r => (
                                    <button key={r.id} type="button" onClick={() => pickRecipe(r)}
                                        className="w-full text-left px-4 py-3 bg-surface-700/60 hover:bg-surface-700 rounded-xl transition-colors active:scale-[0.98]">
                                        <p className="font-medium text-surface-100">{r.name}</p>
                                        <p className="text-xs text-surface-400 mt-0.5">
                                            {r.category} · {(r.ingredients || []).length} ingredients · {(r.prep_time_min || 0) + (r.cook_time_min || 0)}m
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
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
