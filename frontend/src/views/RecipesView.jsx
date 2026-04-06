import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack'];
const CAT_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

const emptyIngredient = () => ({ ingredient_name: '', quantity: 1, unit: '' });

const emptyForm = () => ({
    name: '',
    description: '',
    category: 'dinner',
    prep_time_min: 0,
    cook_time_min: 0,
    servings: 4,
    instructions: [''],
    photo_url: '',
    household_id: 'default',
    ingredients: [emptyIngredient()],
});

export default function RecipesView() {
    const navigate = useNavigate();
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('all');
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [showImport, setShowImport] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importError, setImportError] = useState('');
    const formRef = useRef(null);

    useEffect(() => {
        loadRecipes();
    }, []);

    async function loadRecipes() {
        try {
            const data = await get('/recipes');
            setRecipes(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filteredRecipes = recipes.filter(r => {
        const matchesCat = filterCat === 'all' || r.category === filterCat;
        const q = search.toLowerCase();
        const matchesSearch = !q || r.name.toLowerCase().includes(q) ||
            (r.ingredients || []).some(i => i.ingredient_name.toLowerCase().includes(q));
        return matchesCat && matchesSearch;
    });

    function openNewForm() {
        setEditingId(null);
        setForm(emptyForm());
        setSelectedRecipe(null);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }

    function openEditForm(recipe) {
        setEditingId(recipe.id);
        setForm({
            name: recipe.name || '',
            description: recipe.description || '',
            category: recipe.category || 'dinner',
            prep_time_min: recipe.prep_time_min ?? 0,
            cook_time_min: recipe.cook_time_min ?? 0,
            servings: recipe.servings ?? 4,
            instructions: recipe.instructions?.length ? recipe.instructions : [''],
            photo_url: recipe.photo_url || '',
            household_id: recipe.household_id || 'default',
            ingredients: recipe.ingredients?.length
                ? recipe.ingredients.map(i => ({ ingredient_name: i.ingredient_name, quantity: i.quantity, unit: i.unit }))
                : [emptyIngredient()],
        });
        setSelectedRecipe(null);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }

    function closeForm() {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
    }

    async function submitForm(e) {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                prep_time_min: parseInt(form.prep_time_min) || 0,
                cook_time_min: parseInt(form.cook_time_min) || 0,
                servings: parseInt(form.servings) || 4,
                instructions: form.instructions.filter(s => s.trim()),
                ingredients: form.ingredients
                    .filter(i => i.ingredient_name.trim())
                    .map((i, idx) => ({ ...i, quantity: parseFloat(i.quantity) || 1, order: idx })),
            };
            if (editingId) {
                await put(`/recipes/${editingId}`, payload);
            } else {
                await post('/recipes', payload);
            }
            await loadRecipes();
            closeForm();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteRecipe(id) {
        if (!confirm('Delete this recipe?')) return;
        await del(`/recipes/${id}`);
        setRecipes(prev => prev.filter(r => r.id !== id));
        if (selectedRecipe?.id === id) setSelectedRecipe(null);
        if (editingId === id) closeForm();
    }

    // ── Ingredient row helpers ──────────────────────────────────────────────
    function setIngredient(idx, field, value) {
        setForm(f => {
            const ings = [...f.ingredients];
            ings[idx] = { ...ings[idx], [field]: value };
            return { ...f, ingredients: ings };
        });
    }
    function addIngredient() {
        setForm(f => ({ ...f, ingredients: [...f.ingredients, emptyIngredient()] }));
    }
    function removeIngredient(idx) {
        setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
    }

    // ── Instruction step helpers ────────────────────────────────────────────
    function setStep(idx, value) {
        setForm(f => {
            const steps = [...f.instructions];
            steps[idx] = value;
            return { ...f, instructions: steps };
        });
    }
    function addStep() {
        setForm(f => ({ ...f, instructions: [...f.instructions, ''] }));
    }
    function removeStep(idx) {
        setForm(f => ({ ...f, instructions: f.instructions.filter((_, i) => i !== idx) }));
    }

    // ── URL Import ──────────────────────────────────────────────────────────
    async function handleImport(e) {
        e.preventDefault();
        setImportError('');
        setImportLoading(true);
        try {
            const data = await post('/recipes/import-url', { url: importUrl });
            setForm({
                name: data.name || '',
                description: data.description || '',
                category: data.category || 'dinner',
                prep_time_min: data.prep_time_min ?? 0,
                cook_time_min: data.cook_time_min ?? 0,
                servings: data.servings ?? 4,
                instructions: data.instructions?.length ? data.instructions : [''],
                photo_url: data.photo_url || '',
                household_id: 'default',
                ingredients: data.ingredients?.length
                    ? data.ingredients.map(i => ({ ingredient_name: i.ingredient_name, quantity: i.quantity, unit: i.unit }))
                    : [emptyIngredient()],
            });
            setEditingId(null);
            setShowImport(false);
            setImportUrl('');
            setShowForm(true);
            if (data._note) alert(data._note);
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } catch (err) {
            setImportError(err.message || 'Failed to import recipe');
        } finally {
            setImportLoading(false);
        }
    }

    const totalTime = (r) => (r.prep_time_min || 0) + (r.cook_time_min || 0);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">📖 Recipes</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setShowImport(true); setImportError(''); }}
                        className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        🔗 Import URL
                    </button>
                    <button onClick={openNewForm}
                        className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                        + New Recipe
                    </button>
                </div>
            </div>

            {/* Search + category filter */}
            <div className="flex flex-col gap-3 mb-6">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search recipes or ingredients..."
                    className="bg-surface-800 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500 w-full"
                />
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {['all', ...CATEGORIES].map(cat => (
                        <button key={cat}
                            onClick={() => setFilterCat(cat)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
                                filterCat === cat
                                    ? 'bg-forest-600 text-white'
                                    : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}>
                            {cat === 'all' ? 'All' : `${CAT_EMOJI[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <form ref={formRef} onSubmit={submitForm} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-5">
                    <p className="text-sm font-medium text-surface-300">
                        {editingId ? 'Edit Recipe' : 'New Recipe'}
                    </p>

                    {/* Basic info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Recipe name" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500 md:col-span-2" />
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Short description (optional)" rows={2}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500 resize-none md:col-span-2" />
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                        <input type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
                            placeholder="Servings" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <div>
                            <label className="block text-xs text-surface-400 mb-1">Prep Time (min)</label>
                            <input type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))}
                                min="0"
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-surface-400 mb-1">Cook Time (min)</label>
                            <input type="number" value={form.cook_time_min} onChange={e => setForm(f => ({ ...f, cook_time_min: e.target.value }))}
                                min="0"
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                        <input value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                            placeholder="Photo URL (optional)"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none md:col-span-2" />
                    </div>

                    {/* Ingredients */}
                    <div>
                        <p className="text-xs font-medium text-surface-400 mb-2">Ingredients</p>
                        <div className="space-y-2">
                            {form.ingredients.map((ing, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input type="number" value={ing.quantity} onChange={e => setIngredient(idx, 'quantity', e.target.value)}
                                        placeholder="Qty" step="0.25" min="0"
                                        className="bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none w-20 shrink-0" />
                                    <input value={ing.unit} onChange={e => setIngredient(idx, 'unit', e.target.value)}
                                        placeholder="Unit"
                                        className="bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none w-24 shrink-0" />
                                    <input value={ing.ingredient_name} onChange={e => setIngredient(idx, 'ingredient_name', e.target.value)}
                                        placeholder="Ingredient name"
                                        className="bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none flex-1" />
                                    <button type="button" onClick={() => removeIngredient(idx)}
                                        className="text-surface-500 hover:text-rose-400 transition-colors w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-700/50 shrink-0">✕</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addIngredient}
                            className="mt-2 text-sm text-forest-400 hover:text-forest-300 transition-colors">
                            + Add ingredient
                        </button>
                    </div>

                    {/* Instructions */}
                    <div>
                        <p className="text-xs font-medium text-surface-400 mb-2">Instructions</p>
                        <div className="space-y-2">
                            {form.instructions.map((step, idx) => (
                                <div key={idx} className="flex gap-2 items-start">
                                    <span className="text-surface-500 text-xs font-bold mt-3 w-5 shrink-0 text-right">{idx + 1}.</span>
                                    <textarea value={step} onChange={e => setStep(idx, e.target.value)}
                                        placeholder={`Step ${idx + 1}`} rows={2}
                                        className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-500 resize-none" />
                                    <button type="button" onClick={() => removeStep(idx)}
                                        className="text-surface-500 hover:text-rose-400 transition-colors w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-700/50 mt-0.5 shrink-0">✕</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addStep}
                            className="mt-2 text-sm text-forest-400 hover:text-forest-300 transition-colors">
                            + Add step
                        </button>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={closeForm} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">Cancel</button>
                        {editingId && (
                            <button type="button" onClick={() => deleteRecipe(editingId)}
                                className="px-4 py-2.5 bg-rose-600/20 border border-rose-600/30 text-rose-300 hover:bg-rose-600/30 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                                Delete
                            </button>
                        )}
                        <button type="submit"
                            className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                            {editingId ? 'Save Changes' : 'Create Recipe'}
                        </button>
                    </div>
                </form>
            )}

            {/* Recipe Detail Panel */}
            {selectedRecipe && !showForm && (
                <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-surface-100">{selectedRecipe.name}</h2>
                            {selectedRecipe.description && (
                                <p className="text-sm text-surface-400 mt-1">{selectedRecipe.description}</p>
                            )}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                            <button onClick={() => openEditForm(selectedRecipe)}
                                className="px-3 py-2 bg-surface-700 text-surface-300 hover:text-surface-100 rounded-xl text-sm min-h-[40px] active:scale-[0.97]">
                                Edit
                            </button>
                            <button onClick={() => setSelectedRecipe(null)}
                                className="text-surface-500 hover:text-surface-300 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-700 active:scale-[0.97]">✕</button>
                        </div>
                    </div>

                    {selectedRecipe.photo_url && (
                        <img src={selectedRecipe.photo_url} alt={selectedRecipe.name}
                            className="w-full h-48 object-cover rounded-xl mb-4" />
                    )}

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2 mb-5 text-xs">
                        <span className="bg-surface-700 text-surface-300 px-3 py-1.5 rounded-full">
                            {CAT_EMOJI[selectedRecipe.category]} {selectedRecipe.category}
                        </span>
                        {selectedRecipe.prep_time_min > 0 && (
                            <span className="bg-surface-700 text-surface-300 px-3 py-1.5 rounded-full">
                                ⏱ Prep {selectedRecipe.prep_time_min}m
                            </span>
                        )}
                        {selectedRecipe.cook_time_min > 0 && (
                            <span className="bg-surface-700 text-surface-300 px-3 py-1.5 rounded-full">
                                🔥 Cook {selectedRecipe.cook_time_min}m
                            </span>
                        )}
                        <span className="bg-surface-700 text-surface-300 px-3 py-1.5 rounded-full">
                            🍽 {selectedRecipe.servings} servings
                        </span>
                    </div>

                    {/* Ingredients */}
                    {selectedRecipe.ingredients?.length > 0 && (
                        <div className="mb-5">
                            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Ingredients</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {selectedRecipe.ingredients.map((ing, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-700/60 rounded-lg text-sm">
                                        <span className="text-forest-400 font-medium shrink-0">
                                            {ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(2)}{ing.unit ? ` ${ing.unit}` : ''}
                                        </span>
                                        <span className="text-surface-200">{ing.ingredient_name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    {selectedRecipe.instructions?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Instructions</p>
                            <ol className="space-y-3">
                                {selectedRecipe.instructions.map((step, i) => (
                                    <li key={i} className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 bg-forest-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">{i + 1}</span>
                                        <p className="text-sm text-surface-200 leading-relaxed">{step}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            )}

            {/* Recipe list */}
            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading recipes...</div>
            ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-12 text-surface-400">
                    {recipes.length === 0 ? 'No recipes yet. Create one or import from a URL!' : 'No recipes match your search.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id}
                            onClick={() => { setSelectedRecipe(recipe); setShowForm(false); }}
                            className={`bg-surface-800 hover:bg-surface-750 rounded-2xl p-5 cursor-pointer transition-colors ${
                                selectedRecipe?.id === recipe.id ? 'ring-2 ring-forest-500' : ''
                            }`}>
                            {recipe.photo_url && (
                                <img src={recipe.photo_url} alt={recipe.name}
                                    className="w-full h-32 object-cover rounded-xl mb-3" />
                            )}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-surface-100 truncate">{recipe.name}</p>
                                    {recipe.description && (
                                        <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{recipe.description}</p>
                                    )}
                                </div>
                                <span className="text-xl shrink-0">{CAT_EMOJI[recipe.category] || '🍽️'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3 text-xs text-surface-400">
                                {totalTime(recipe) > 0 && (
                                    <span>⏱ {totalTime(recipe)}m total</span>
                                )}
                                <span>🍽 {recipe.servings} servings</span>
                                {recipe.ingredients?.length > 0 && (
                                    <span>🧄 {recipe.ingredients.length} ingredients</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Import from URL Modal */}
            {showImport && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowImport(false)}>
                    <div className="bg-surface-800 rounded-2xl p-6 max-w-md w-full mx-4"
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-surface-100 mb-4">🔗 Import from URL</h2>
                        <p className="text-sm text-surface-400 mb-4">
                            Paste a recipe URL. Structured data (Schema.org) is extracted automatically; otherwise a basic outline is pre-filled for you to complete.
                        </p>
                        <form onSubmit={handleImport} className="space-y-3">
                            <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
                                placeholder="https://example.com/recipe/..." required
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                            {importError && (
                                <p className="text-sm text-rose-400">{importError}</p>
                            )}
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowImport(false)}
                                    className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">
                                    Cancel
                                </button>
                                <button type="submit" disabled={importLoading}
                                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                                    {importLoading ? 'Importing...' : 'Import'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
