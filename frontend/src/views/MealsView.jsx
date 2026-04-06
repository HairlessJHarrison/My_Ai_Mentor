import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import PresetBrowser from '../components/PresetBrowser';
import { MEAL_PRESETS } from '../data/mealPresets';

const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10), meal_type: 'dinner',
    recipe_name: '', ingredients: '', est_cost: '', health_score: 7,
    prep_time_min: 30, household_id: 'default',
});

const typeEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---- Sub-components -------------------------------------------------------

function TabBar({ active, onChange }) {
    const tabs = [
        { id: 'plan', label: '📅 Plan' },
        { id: 'history', label: '📖 History' },
        { id: 'shopping', label: '🛒 Shopping' },
        { id: 'suggestions', label: '✨ Suggestions' },
    ];
    return (
        <div className="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1">
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]
                        ${active === t.id
                            ? 'bg-forest-600 text-white'
                            : 'text-surface-400 hover:text-surface-200'}`}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function MarkCookedModal({ meal, members, onClose, onSaved }) {
    const [cookedBy, setCookedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const params = new URLSearchParams();
            if (cookedBy) params.set('cooked_by', cookedBy);
            if (notes) params.set('notes', notes);
            await post(`/meals/plan/${meal.id}/mark-cooked?${params}`);
            onSaved();
            onClose();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface-800 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-surface-100 mb-1">Mark as Cooked</h2>
                <p className="text-surface-400 text-sm mb-4">{meal.recipe_name}</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <select value={cookedBy} onChange={e => setCookedBy(e.target.value)}
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                        <option value="">Who cooked? (optional)</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    <div className="flex gap-3 justify-end pt-1">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97] disabled:opacity-50">
                            {saving ? 'Saving…' : 'Mark Cooked'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---- Plan Tab -------------------------------------------------------------

function PlanTab({ meals, loading, members, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showPresets, setShowPresets] = useState(false);
    const [showGrocery, setShowGrocery] = useState(false);
    const [grocery, setGrocery] = useState(null);
    const [markingMeal, setMarkingMeal] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const formRef = useRef(null);

    const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    const openNewForm = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); scrollToForm(); };
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
        });
        setShowForm(true); scrollToForm();
    };
    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); };

    const loadGrocery = async () => {
        try {
            const data = await get('/meals/grocery-list?week=current');
            setGrocery(data); setShowGrocery(true);
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
            };
            if (editingId) await put(`/meals/plan/${editingId}`, payload);
            else await post('/meals/plan', payload);
            await onRefresh();
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
        await onRefresh();
    };

    const deleteMeal = async (id) => {
        if (!confirm('Delete this meal?')) return;
        await del(`/meals/plan/${id}`);
        await onRefresh();
        if (editingId === id) closeForm();
    };

    const mealList = meals?.meals || [];

    return (
        <>
            <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={loadGrocery}
                    className="px-4 py-2.5 bg-amber-600/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                    🛒 Quick Grocery List
                </button>
                <button onClick={() => setShowPresets(true)}
                    className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                    Browse Presets
                </button>
                <button onClick={openNewForm}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97] ml-auto">
                    + Add Meal
                </button>
            </div>

            {showForm && (
                <form ref={formRef} onSubmit={submitForm} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <p className="text-sm font-medium text-surface-300">{editingId ? 'Edit Meal' : 'New Meal'}</p>
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
                                <label className="block text-xs text-surface-400 mb-1">Prep Time (min)</label>
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
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                            {editingId ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading meals...</div>
            ) : mealList.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No meals planned. Add one above!</div>
            ) : (
                <div className="space-y-3">
                    {mealList.map(meal => (
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
                            <button
                                onClick={(e) => { e.stopPropagation(); setMarkingMeal(meal); }}
                                title="Mark as cooked"
                                className="text-surface-500 hover:text-forest-400 transition-colors text-sm w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-700/50 active:scale-[0.95]">
                                ✓
                            </button>
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

            {markingMeal && (
                <MarkCookedModal
                    meal={markingMeal}
                    members={members}
                    onClose={() => setMarkingMeal(null)}
                    onSaved={() => {}}
                />
            )}
        </>
    );
}

// ---- History Tab ----------------------------------------------------------

function HistoryTab({ members }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set('start_date', startDate);
            if (endDate) params.set('end_date', endDate);
            const data = await get(`/meals/history?${params}`);
            setHistory(data.history || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const logManual = async () => {
        // Opens a quick inline log — reuses the mark-cooked flow
        const name = prompt('Recipe name?');
        if (!name) return;
        const dateStr = prompt('Date (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
        if (!dateStr) return;
        try {
            await post('/meals/history', {
                recipe_name: name,
                date: dateStr,
                meal_type: 'dinner',
                household_id: 'default',
            });
            load();
        } catch (e) { alert(e.message); }
    };

    return (
        <div>
            <div className="flex gap-2 mb-4 flex-wrap items-end">
                <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-surface-400 mb-1">From</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-surface-800 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-surface-400 mb-1">To</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-surface-800 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <button onClick={load}
                    className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
                    Filter
                </button>
                <button onClick={logManual}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
                    + Log Meal
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading history...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No cooking history yet. Mark a planned meal as cooked!</div>
            ) : (
                <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-surface-700" />
                    <div className="space-y-4">
                        {history.map(entry => {
                            const cooker = entry.cooked_by ? memberMap[entry.cooked_by] : null;
                            return (
                                <div key={entry.id} className="relative flex gap-4">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-4 top-4 w-3 h-3 rounded-full bg-forest-500 border-2 border-surface-900" />
                                    <div className="flex-1 bg-surface-800 rounded-xl px-4 py-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-medium text-surface-100">{entry.recipe_name}</p>
                                                <p className="text-sm text-surface-400 mt-0.5">
                                                    {entry.date} · {typeEmoji[entry.meal_type] || '🍽️'} {entry.meal_type}
                                                    {cooker && <span className="ml-2 text-ocean-400">by {cooker.name}</span>}
                                                </p>
                                                {entry.notes && <p className="text-xs text-surface-500 mt-1 italic">{entry.notes}</p>}
                                            </div>
                                            {cooker?.color && (
                                                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                                                    style={{ backgroundColor: cooker.color }} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Shopping Tab ---------------------------------------------------------

function ShoppingTab() {
    const [lists, setLists] = useState([]);
    const [activeList, setActiveList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [showGenerate, setShowGenerate] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [genForm, setGenForm] = useState({
        name: `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        start_date: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10); })(),
        end_date: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 7); return d.toISOString().slice(0, 10); })(),
    });

    const loadLists = async () => {
        try {
            const data = await get('/shopping-lists');
            setLists(data.lists || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const openList = async (id) => {
        try {
            const data = await get(`/shopping-lists/${id}`);
            setActiveList(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadLists(); }, []);

    const generate = async (e) => {
        e.preventDefault();
        setGenerating(true);
        try {
            const data = await post('/shopping-lists/generate', { ...genForm, household_id: 'default' });
            setLists(prev => [data, ...prev]);
            setActiveList(data);
            setShowGenerate(false);
        } catch (err) { alert(err.message); }
        finally { setGenerating(false); }
    };

    const toggleItem = async (item) => {
        try {
            const updated = await put(`/shopping-lists/${activeList.id}/items/${item.id}`, { checked: !item.checked });
            setActiveList(prev => ({
                ...prev,
                items: prev.items.map(i => i.id === item.id ? updated : i),
            }));
        } catch (e) { console.error(e); }
    };

    const addManualItem = async (e) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        try {
            const item = await post(`/shopping-lists/${activeList.id}/items`, { ingredient_name: newItemName.trim() });
            setActiveList(prev => ({ ...prev, items: [...(prev.items || []), item] }));
            setNewItemName('');
        } catch (err) { alert(err.message); }
    };

    const deleteList = async (id) => {
        if (!confirm('Delete this shopping list?')) return;
        try {
            await del(`/shopping-lists/${id}`);
            setLists(prev => prev.filter(l => l.id !== id));
            if (activeList?.id === id) setActiveList(null);
        } catch (e) { console.error(e); }
    };

    const checkedCount = activeList?.items?.filter(i => i.checked).length || 0;
    const totalCount = activeList?.items?.length || 0;

    if (activeList) {
        const byRecipe = {};
        for (const item of (activeList.items || [])) {
            const key = item.recipe_source || 'Manual';
            if (!byRecipe[key]) byRecipe[key] = [];
            byRecipe[key].push(item);
        }

        return (
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => setActiveList(null)}
                        className="text-surface-400 hover:text-surface-200 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">
                        &larr;
                    </button>
                    <div className="flex-1">
                        <h2 className="font-semibold text-surface-100">{activeList.name}</h2>
                        <p className="text-xs text-surface-400">{checkedCount}/{totalCount} checked</p>
                    </div>
                    {totalCount > 0 && (
                        <div className="text-xs text-surface-500">
                            <div className="w-24 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-forest-500 rounded-full transition-all"
                                    style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 mb-6">
                    {Object.entries(byRecipe).map(([source, items]) => (
                        <div key={source}>
                            <p className="text-xs text-surface-500 uppercase tracking-wide font-medium mb-2 px-1">{source}</p>
                            <div className="space-y-1">
                                {items.map(item => (
                                    <button key={item.id} onClick={() => toggleItem(item)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left active:scale-[0.98]
                                            ${item.checked ? 'bg-surface-800/50 opacity-60' : 'bg-surface-800'}`}>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors
                                            ${item.checked ? 'bg-forest-600 border-forest-600 text-white' : 'border-surface-600'}`}>
                                            {item.checked && <span className="text-xs leading-none">✓</span>}
                                        </div>
                                        <span className={`flex-1 text-sm ${item.checked ? 'line-through text-surface-500' : 'text-surface-200'}`}>
                                            {item.ingredient_name}
                                        </span>
                                        {item.quantity && item.quantity > 1 && (
                                            <span className="text-xs text-surface-500">×{item.quantity}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={addManualItem} className="flex gap-2">
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)}
                        placeholder="Add item..."
                        className="flex-1 bg-surface-800 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                    <button type="submit"
                        className="px-4 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium active:scale-[0.97]">
                        Add
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="flex gap-2 mb-4">
                <button onClick={() => setShowGenerate(v => !v)}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97] ml-auto">
                    + Generate List
                </button>
            </div>

            {showGenerate && (
                <form onSubmit={generate} className="bg-surface-800 rounded-2xl p-5 mb-4 space-y-3">
                    <p className="text-sm font-medium text-surface-300">Generate from meal plans</p>
                    <input value={genForm.name} onChange={e => setGenForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="List name"
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs text-surface-400 mb-1">Start date</label>
                            <input type="date" value={genForm.start_date} onChange={e => setGenForm(f => ({ ...f, start_date: e.target.value }))}
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-surface-400 mb-1">End date</label>
                            <input type="date" value={genForm.end_date} onChange={e => setGenForm(f => ({ ...f, end_date: e.target.value }))}
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => {
                            const d = new Date();
                            const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
                            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                            setGenForm(f => ({ ...f, start_date: mon.toISOString().slice(0, 10), end_date: sun.toISOString().slice(0, 10) }));
                        }} className="px-3 py-1.5 bg-surface-700 text-surface-300 rounded-lg text-xs active:scale-[0.97]">This Week</button>
                        <button type="button" onClick={() => {
                            const d = new Date();
                            const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 8);
                            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                            setGenForm(f => ({ ...f, start_date: mon.toISOString().slice(0, 10), end_date: sun.toISOString().slice(0, 10) }));
                        }} className="px-3 py-1.5 bg-surface-700 text-surface-300 rounded-lg text-xs active:scale-[0.97]">Next Week</button>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowGenerate(false)}
                            className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" disabled={generating}
                            className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97] disabled:opacity-50">
                            {generating ? 'Generating…' : 'Generate'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading lists...</div>
            ) : lists.length === 0 ? (
                <div className="text-center py-12 text-surface-400">No shopping lists yet. Generate one from your meal plans!</div>
            ) : (
                <div className="space-y-3">
                    {lists.map(list => (
                        <div key={list.id} className="flex items-center gap-3 bg-surface-800 rounded-xl px-5 py-4 cursor-pointer hover:bg-surface-750"
                            onClick={() => openList(list.id)}>
                            <span className="text-xl">🛒</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-surface-100">{list.name}</p>
                                <p className="text-xs text-surface-400">{new Date(list.created_at).toLocaleDateString()}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteList(list.id); }}
                                className="text-surface-500 hover:text-rose-400 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-700/50 active:scale-[0.95]">✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---- Suggestions Tab -------------------------------------------------------

function SuggestionsTab({ members }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(null);
    const [scheduleForm, setScheduleForm] = useState(null);

    useEffect(() => {
        get('/meals/suggestions?count=5')
            .then(data => setSuggestions(data.suggestions || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const addToPlan = async (suggestion) => {
        const date = prompt('Schedule for date (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
        if (!date) return;
        const mealType = prompt('Meal type? (breakfast/lunch/dinner/snack)', 'dinner');
        if (!mealType) return;
        setAdding(suggestion.recipe_name);
        try {
            await post('/meals/plan', {
                household_id: 'default',
                date,
                meal_type: mealType,
                recipe_name: suggestion.recipe_name,
                ingredients: [],
                est_cost: 0,
                health_score: 7,
                prep_time_min: 30,
            });
            alert(`"${suggestion.recipe_name}" added to meal plan!`);
        } catch (err) { alert(err.message); }
        finally { setAdding(null); }
    };

    const refresh = () => {
        setLoading(true);
        get('/meals/suggestions?count=5')
            .then(data => setSuggestions(data.suggestions || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-surface-400 text-sm">Based on your cooking history</p>
                <button onClick={refresh}
                    className="px-3 py-2 bg-surface-800 text-surface-300 hover:text-surface-100 rounded-xl text-sm active:scale-[0.97]">
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-surface-400">Finding suggestions...</div>
            ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-surface-400">
                    <p className="mb-2">No suggestions yet.</p>
                    <p className="text-xs">Cook some meals and mark them as cooked to get personalized suggestions!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {suggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-4 bg-surface-800 rounded-xl px-5 py-4">
                            <div className="w-8 h-8 rounded-full bg-forest-600/20 flex items-center justify-center text-forest-400 font-bold text-sm flex-shrink-0">
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-surface-100">{s.recipe_name}</p>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    {s.last_cooked
                                        ? `Last cooked ${s.last_cooked}`
                                        : s.source === 'meal_plan' ? 'From your meal plans' : 'Never cooked'}
                                </p>
                            </div>
                            <button
                                onClick={() => addToPlan(s)}
                                disabled={adding === s.recipe_name}
                                className="px-3 py-2 bg-forest-600/20 border border-forest-600/30 text-forest-300 hover:bg-forest-600/30 rounded-xl text-sm font-medium active:scale-[0.97] disabled:opacity-50 flex-shrink-0">
                                {adding === s.recipe_name ? '…' : '+ Plan'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---- Main View ------------------------------------------------------------

export default function MealsView() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('plan');
    const [meals, setMeals] = useState({ meals: [], total_cost: 0, avg_health_score: 0 });
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);

    const loadMeals = async () => {
        try {
            const data = await get('/meals/plan?week=current');
            setMeals(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        Promise.all([get('/meals/plan?week=current'), get('/members')])
            .then(([m, mem]) => { setMeals(m); setMembers(mem); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/')}
                    className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl active:scale-[0.97]">
                    &larr;
                </button>
                <h1 className="text-2xl font-bold text-surface-100">🍽️ Meals</h1>
            </div>

            {/* Summary bar (plan tab only) */}
            {tab === 'plan' && (
                <div className="flex gap-4 mb-6 text-sm">
                    <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                        <p className="text-surface-400 text-sm">Weekly Cost</p>
                        <p className="text-amber-300 font-semibold">${meals.total_cost?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                        <p className="text-surface-400 text-sm">Avg Health</p>
                        <p className="text-forest-300 font-semibold">{meals.avg_health_score || 0}/10</p>
                    </div>
                    <div className="bg-surface-800 rounded-xl px-4 py-3 flex-1 text-center">
                        <p className="text-surface-400 text-sm">Planned</p>
                        <p className="text-ocean-300 font-semibold">{meals.meals?.length || 0}</p>
                    </div>
                </div>
            )}

            <TabBar active={tab} onChange={setTab} />

            {tab === 'plan' && (
                <PlanTab meals={meals} loading={loading} members={members} onRefresh={loadMeals} />
            )}
            {tab === 'history' && <HistoryTab members={members} />}
            {tab === 'shopping' && <ShoppingTab />}
            {tab === 'suggestions' && <SuggestionsTab members={members} />}
        </div>
    );
}
