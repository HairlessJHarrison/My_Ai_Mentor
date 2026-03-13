import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import PresetBrowser from '../components/PresetBrowser';
import { MEAL_PRESETS } from '../data/mealPresets';
import { CHORE_PRESETS } from '../data/chorePresets';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EVENT_TYPES = ['appointment', 'work', 'school', 'social', 'errand', 'protected_time', 'other'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const FREQUENCIES = ['daily', 'weekly', 'as_needed'];
const TYPE_EMOJI = { appointment: '📋', work: '💼', school: '🎓', social: '🤝', errand: '🏃', protected_time: '🛡️', other: '📌' };
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getWeekDays(monday) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return formatDate(d);
    });
}

function emptyEventForm(date) {
    return {
        title: '', date: date || formatDate(new Date()),
        start_time: '09:00', end_time: '10:00', event_type: 'other',
        household_id: 'default', assigned_member_ids: [],
    };
}

function emptyMealForm(date) {
    return {
        recipe_name: '', meal_type: 'dinner', date: date || formatDate(new Date()),
        ingredients: '', est_cost: '', health_score: 7, prep_time_min: 30,
        household_id: 'default',
    };
}

function emptyChoreForm() {
    return {
        title: '', points: 5, frequency: 'daily',
        household_id: 'default', assigned_member_ids: [],
    };
}

export default function CalendarView() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('today'); // 'today' | 'week'
    const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
    const [todayDate, setTodayDate] = useState(() => formatDate(new Date()));
    const [members, setMembers] = useState([]);
    const [events, setEvents] = useState([]);
    const [mealsByDay, setMealsByDay] = useState({});
    const [choresByDay, setChoresByDay] = useState({});
    const [allChores, setAllChores] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState('event');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyEventForm());
    const [showPresets, setShowPresets] = useState(null);

    const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

    const weekLabel = useMemo(() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    }, [weekStart]);

    const todayLabel = useMemo(() => {
        const d = new Date(todayDate + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }, [todayDate]);

    const isTodayActual = todayDate === formatDate(new Date());

    // --- Data loading ---
    const loadWeekData = async () => {
        setLoading(true);
        try {
            const [scheduleData, memberData, choreData, ...mealResults] = await Promise.all([
                get(`/schedules/week?start_date=${formatDate(weekStart)}`),
                get('/members'),
                get('/chores'),
                ...days.map(d => get(`/meals/plan?date=${d}`).catch(() => ({ meals: [] }))),
            ]);

            setEvents(scheduleData.events || []);
            setMembers(memberData);
            setAllChores(choreData);

            const mealsMap = {};
            days.forEach((d, i) => { mealsMap[d] = mealResults[i]?.meals || []; });
            setMealsByDay(mealsMap);

            const choreResults = await Promise.all(
                days.map(d => get(`/chores/status?date=${d}`).catch(() => ({ members: [] })))
            );
            const choresMap = {};
            days.forEach((d, i) => {
                const seen = new Set();
                const dayChores = [];
                for (const member of (choreResults[i]?.members || [])) {
                    for (const item of (member.chores || [])) {
                        if (!seen.has(item.chore.id)) {
                            seen.add(item.chore.id);
                            dayChores.push(item);
                        }
                    }
                }
                choresMap[d] = dayChores;
            });
            setChoresByDay(choresMap);
        } catch (err) {
            console.error('Calendar load error:', err);
        }
        setLoading(false);
    };

    const loadTodayData = async () => {
        setLoading(true);
        try {
            const [scheduleData, memberData, choreData, mealData, choreStatus] = await Promise.all([
                get(`/schedules/week?start_date=${formatDate(getMonday(new Date(todayDate + 'T00:00:00')))}`),
                get('/members'),
                get('/chores'),
                get(`/meals/plan?date=${todayDate}`).catch(() => ({ meals: [] })),
                get(`/chores/status?date=${todayDate}`).catch(() => ({ members: [] })),
            ]);

            setEvents(scheduleData.events || []);
            setMembers(memberData);
            setAllChores(choreData);
            setMealsByDay({ [todayDate]: mealData.meals || [] });

            const seen = new Set();
            const dayChores = [];
            for (const member of (choreStatus.members || [])) {
                for (const item of (member.chores || [])) {
                    if (!seen.has(item.chore.id)) {
                        seen.add(item.chore.id);
                        dayChores.push(item);
                    }
                }
            }
            setChoresByDay({ [todayDate]: dayChores });
        } catch (err) {
            console.error('Calendar load error:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (viewMode === 'week') loadWeekData();
        else loadTodayData();
    }, [viewMode, weekStart, todayDate]);

    const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    const goToday = () => { setWeekStart(getMonday(new Date())); setTodayDate(formatDate(new Date())); };
    const prevDay = () => setTodayDate(d => { const n = new Date(d + 'T00:00:00'); n.setDate(n.getDate() - 1); return formatDate(n); });
    const nextDay = () => setTodayDate(d => { const n = new Date(d + 'T00:00:00'); n.setDate(n.getDate() + 1); return formatDate(n); });

    // --- Form handling ---
    const openNewForm = (date, type = 'event') => {
        setEditingId(null);
        setFormType(type);
        if (type === 'event') setForm(emptyEventForm(date));
        else if (type === 'meal') setForm(emptyMealForm(date));
        else setForm(emptyChoreForm());
        setShowForm(true);
    };

    const openEditEvent = (event) => {
        setEditingId(event.id);
        setFormType('event');
        setForm({
            title: event.title || '', date: event.date || formatDate(new Date()),
            start_time: event.start_time?.slice(0, 5) || '09:00',
            end_time: event.end_time?.slice(0, 5) || '10:00',
            event_type: event.event_type || 'other',
            household_id: event.household_id || 'default',
            assigned_member_ids: event.assigned_member_ids || [],
        });
        setShowForm(true);
    };

    const openEditMeal = (meal) => {
        setEditingId(meal.id);
        setFormType('meal');
        setForm({
            recipe_name: meal.recipe_name || '', meal_type: meal.meal_type || 'dinner',
            date: meal.date || formatDate(new Date()),
            ingredients: (meal.ingredients || []).join(', '),
            est_cost: meal.est_cost ?? '', health_score: meal.health_score ?? 7,
            prep_time_min: meal.prep_time_min ?? 30,
            household_id: meal.household_id || 'default',
        });
        setShowForm(true);
    };

    const openEditChore = (choreItem) => {
        const chore = choreItem.chore;
        setEditingId(chore.id);
        setFormType('chore');
        setForm({
            title: chore.title || '', points: chore.points ?? 5,
            frequency: chore.frequency || 'daily',
            household_id: chore.household_id || 'default',
            assigned_member_ids: chore.assigned_member_ids || [],
        });
        setShowForm(true);
    };

    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyEventForm()); };

    const switchFormType = (type) => {
        const currentDate = form.date || (viewMode === 'today' ? todayDate : formatDate(new Date()));
        setFormType(type);
        setEditingId(null);
        if (type === 'event') setForm(emptyEventForm(currentDate));
        else if (type === 'meal') setForm(emptyMealForm(currentDate));
        else setForm(emptyChoreForm());
    };

    const toggleMemberAssignment = (memberId) => {
        setForm(f => {
            const ids = (f.assigned_member_ids || []).includes(memberId)
                ? f.assigned_member_ids.filter(id => id !== memberId)
                : [...(f.assigned_member_ids || []), memberId];
            return { ...f, assigned_member_ids: ids };
        });
    };

    const submitForm = async (e) => {
        e.preventDefault();
        try {
            if (formType === 'event') {
                const payload = { ...form, start_time: form.start_time + ':00', end_time: form.end_time + ':00' };
                if (editingId) await put(`/schedules/events/${editingId}`, payload);
                else await post('/schedules/events', payload);
            } else if (formType === 'meal') {
                const payload = {
                    ...form,
                    ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
                    est_cost: parseFloat(form.est_cost) || 0,
                    health_score: parseInt(form.health_score),
                    prep_time_min: parseInt(form.prep_time_min),
                };
                if (editingId) await put(`/meals/plan/${editingId}`, payload);
                else await post('/meals/plan', payload);
            } else {
                const payload = {
                    ...form, points: parseInt(form.points),
                    assigned_member_ids: form.assigned_member_ids?.length > 0 ? form.assigned_member_ids : [],
                };
                if (editingId) await put(`/chores/${editingId}`, payload);
                else await post('/chores', payload);
            }
            closeForm();
            if (viewMode === 'week') await loadWeekData();
            else await loadTodayData();
        } catch (err) { alert(err.message); }
    };

    const deleteItem = async () => {
        if (!confirm('Delete this item?')) return;
        try {
            if (formType === 'event') await del(`/schedules/events/${editingId}`);
            else if (formType === 'meal') await del(`/meals/plan/${editingId}`);
            else await del(`/chores/${editingId}`);
            closeForm();
            if (viewMode === 'week') await loadWeekData();
            else await loadTodayData();
        } catch (err) { alert(err.message); }
    };

    const completeChore = async (choreId) => {
        const parent = members.find(m => m.role === 'parent');
        const memberId = parent?.id || members[0]?.id;
        if (!memberId) return;
        try {
            await post('/chores/complete', { chore_id: choreId, member_id: memberId });
            if (viewMode === 'week') await loadWeekData();
            else await loadTodayData();
        } catch (err) { alert(err.message); }
    };

    const addFromPreset = async (preset) => {
        if (showPresets === 'meal') {
            await post('/meals/plan', {
                household_id: 'default',
                date: preset.date || (viewMode === 'today' ? todayDate : formatDate(new Date())),
                meal_type: preset.meal_type, recipe_name: preset.recipe_name,
                ingredients: Array.isArray(preset.ingredients) ? preset.ingredients : preset.ingredients.split(',').map(s => s.trim()),
                est_cost: parseFloat(preset.est_cost) || 0,
                health_score: parseInt(preset.health_score),
                prep_time_min: parseInt(preset.prep_time_min),
            });
        } else {
            await post('/chores', {
                household_id: 'default', title: preset.title,
                points: preset.points, frequency: preset.frequency,
                assigned_member_ids: preset.assigned_member_ids || [],
            });
        }
        if (viewMode === 'week') await loadWeekData();
        else await loadTodayData();
    };

    const eventsForDay = (date) => events.filter(e => e.date === date);
    const mealsForDay = (date) => mealsByDay[date] || [];
    const choresForDay = (date) => choresByDay[date] || [];
    const isTodayDate = (date) => date === formatDate(new Date());

    // Today view data
    const todayEvents = useMemo(() =>
        eventsForDay(todayDate).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [events, todayDate]);
    const todayMeals = useMemo(() => mealsForDay(todayDate), [mealsByDay, todayDate]);
    const todayChores = useMemo(() => choresForDay(todayDate), [choresByDay, todayDate]);
    const completedChores = todayChores.filter(c => c.completed).length;

    // Group meals by type for today view
    const mealsByType = useMemo(() => {
        const grouped = {};
        for (const type of MEAL_TYPES) {
            const items = todayMeals.filter(m => m.meal_type === type);
            if (items.length > 0) grouped[type] = items;
        }
        return grouped;
    }, [todayMeals]);

    // --- Render form (shared) ---
    const renderForm = () => (
        <div className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
            {!editingId && (
                <div className="flex gap-2 mb-2">
                    {[
                        { key: 'event', label: '📅 Event', bg: 'bg-ocean-600' },
                        { key: 'meal', label: '🍽️ Meal', bg: 'bg-amber-600' },
                        { key: 'chore', label: '🧹 Chore', bg: 'bg-forest-600' },
                    ].map(t => (
                        <button key={t.key} onClick={() => switchFormType(t.key)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                formType === t.key
                                    ? `${t.bg} text-white`
                                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
            <p className="text-sm font-medium text-surface-300">
                {editingId ? `Edit ${formType.charAt(0).toUpperCase() + formType.slice(1)}` : `New ${formType.charAt(0).toUpperCase() + formType.slice(1)}`}
            </p>

            <form onSubmit={submitForm} className="space-y-4">
                {formType === 'event' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Event title" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ocean-500" />
                        <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </select>
                        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <div className="flex gap-2">
                            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                    </div>
                )}

                {formType === 'meal' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.recipe_name} onChange={e => setForm(f => ({ ...f, recipe_name: e.target.value }))}
                            placeholder="Recipe name" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                        <select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
                                <label className="block text-xs text-surface-400 mb-1">Health (1-10)</label>
                                <input type="number" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: e.target.value }))}
                                    min="1" max="10"
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-surface-400 mb-1">Prep (min)</label>
                                <input type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))}
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                        </div>
                    </div>
                )}

                {formType === 'chore' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Chore name" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                            placeholder="Points" min="1"
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                )}

                {(formType === 'event' || formType === 'chore') && members.length > 0 && (
                    <div>
                        <label className="block text-xs text-surface-400 mb-2">
                            {formType === 'chore' ? 'Assign to (leave empty for everyone):' : 'Assign Members'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {members.map(m => (
                                <button key={m.id} type="button" onClick={() => toggleMemberAssignment(m.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                        (form.assigned_member_ids || []).includes(m.id)
                                            ? 'bg-forest-600 text-white'
                                            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                    }`}>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button type="button" onClick={closeForm}
                        className="px-4 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm">Cancel</button>
                    {editingId && (
                        <button type="button" onClick={deleteItem}
                            className="px-4 py-2 bg-rose-600/20 border border-rose-600/30 text-rose-300 hover:bg-rose-600/30 rounded-xl text-sm font-medium transition-colors">
                            Delete
                        </button>
                    )}
                    <button type="submit"
                        className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium">
                        {editingId ? 'Save Changes' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );

    // --- Today view ---
    const renderTodayView = () => (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Schedule / Timeline */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                        📅 Schedule
                        <span className="text-sm font-normal text-surface-400">({todayEvents.length})</span>
                    </h2>
                    <button onClick={() => openNewForm(todayDate, 'event')}
                        className="px-3 py-1.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-lg text-xs font-medium transition-colors">
                        + Event
                    </button>
                </div>
                {todayEvents.length === 0 ? (
                    <div className="bg-surface-800 rounded-xl px-5 py-6 text-center text-surface-500 text-sm">
                        No events scheduled
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todayEvents.map(event => (
                            <div key={event.id}
                                onClick={() => openEditEvent(event)}
                                className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-colors cursor-pointer
                                    ${editingId === event.id && formType === 'event' ? 'ring-2 ring-ocean-400' : ''}
                                    ${event.is_protected
                                        ? 'bg-forest-900/30 border border-forest-700/30 hover:bg-forest-900/40'
                                        : 'bg-surface-800 hover:bg-surface-750'}`}>
                                <span className="text-xl">{TYPE_EMOJI[event.event_type] || '📌'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-surface-100 truncate">{event.title}</p>
                                    <p className="text-xs text-surface-400">
                                        {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                                        <span className="ml-2 capitalize">{event.event_type.replace(/_/g, ' ')}</span>
                                    </p>
                                    {event.location && (
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            <span className="text-forest-400">📍</span> {event.location}
                                            {event.travel_time_min && <span className="ml-2 text-amber-400/70">~{event.travel_time_min}m drive</span>}
                                        </p>
                                    )}
                                </div>
                                {event.assigned_member_ids?.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                        {event.assigned_member_ids.map(id => {
                                            const m = members.find(mem => mem.id === id);
                                            return m ? <span key={id} className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} title={m.name} /> : null;
                                        })}
                                    </div>
                                )}
                                {event.is_protected && <span className="text-forest-400 text-xs font-medium">Protected</span>}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Meals */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                        🍽️ Meals
                        <span className="text-sm font-normal text-surface-400">({todayMeals.length})</span>
                    </h2>
                    <button onClick={() => openNewForm(todayDate, 'meal')}
                        className="px-3 py-1.5 bg-amber-600/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/30 rounded-lg text-xs font-medium transition-colors">
                        + Meal
                    </button>
                </div>
                {todayMeals.length === 0 ? (
                    <div className="bg-surface-800 rounded-xl px-5 py-6 text-center text-surface-500 text-sm">
                        No meals planned
                    </div>
                ) : (
                    <div className="space-y-3">
                        {Object.entries(mealsByType).map(([type, items]) => (
                            <div key={type}>
                                <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    {MEAL_EMOJI[type]} {type}
                                </p>
                                <div className="space-y-1.5">
                                    {items.map(meal => (
                                        <div key={meal.id}
                                            onClick={() => openEditMeal(meal)}
                                            className={`flex items-center gap-4 px-5 py-3 bg-surface-800 rounded-xl transition-colors cursor-pointer hover:bg-surface-750
                                                ${editingId === meal.id && formType === 'meal' ? 'ring-2 ring-amber-400' : ''}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-surface-100 truncate">{meal.recipe_name}</p>
                                                <p className="text-xs text-surface-400">
                                                    {meal.prep_time_min}m prep
                                                    <span className="ml-2 text-amber-400">${meal.est_cost?.toFixed(2)}</span>
                                                    <span className="ml-2 text-surface-500">{(meal.ingredients || []).length} ingredients</span>
                                                </p>
                                            </div>
                                            <span className="text-xs text-forest-400 font-medium">{meal.health_score}/10</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Chores */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                        🧹 Chores
                        <span className="text-sm font-normal text-surface-400">
                            ({completedChores}/{todayChores.length})
                        </span>
                    </h2>
                    <button onClick={() => openNewForm(todayDate, 'chore')}
                        className="px-3 py-1.5 bg-forest-600/20 border border-forest-600/30 text-forest-300 hover:bg-forest-600/30 rounded-lg text-xs font-medium transition-colors">
                        + Chore
                    </button>
                </div>
                {todayChores.length > 0 && (
                    <div className="bg-surface-800 rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-forest-500 rounded-full transition-all duration-500"
                                    style={{ width: `${todayChores.length > 0 ? (completedChores / todayChores.length * 100) : 0}%` }} />
                            </div>
                            <span className="text-sm font-medium text-surface-300">
                                {todayChores.length > 0 ? Math.round(completedChores / todayChores.length * 100) : 0}%
                            </span>
                        </div>
                    </div>
                )}
                {todayChores.length === 0 ? (
                    <div className="bg-surface-800 rounded-xl px-5 py-6 text-center text-surface-500 text-sm">
                        No chores for today
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todayChores.map(item => (
                            <div key={item.chore.id}
                                className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-colors
                                    ${item.completed ? 'bg-surface-800/60' : 'bg-surface-800'}`}>
                                <button onClick={() => !item.completed && completeChore(item.chore.id)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                        item.completed
                                            ? 'bg-forest-600 border-forest-600 text-white'
                                            : 'border-surface-500 hover:border-forest-400'
                                    }`}>
                                    {item.completed && <span className="text-xs">✓</span>}
                                </button>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditChore(item)}>
                                    <p className={`font-medium ${item.completed ? 'text-surface-500 line-through' : 'text-surface-100'}`}>
                                        {item.chore.title}
                                    </p>
                                    <p className="text-xs text-surface-400">
                                        <span className="text-amber-400">+{item.chore.points} pts</span>
                                        <span className="mx-1">·</span>
                                        <span>{item.chore.frequency?.replace(/_/g, ' ')}</span>
                                    </p>
                                </div>
                                {item.chore.assigned_member_ids?.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                        {item.chore.assigned_member_ids.map(id => {
                                            const m = members.find(mem => mem.id === id);
                                            return m ? <span key={id} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} title={m.name} /> : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );

    // --- Week view ---
    const renderWeekView = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                {days.map((date, i) => {
                    const dayEvents = eventsForDay(date);
                    const dayMeals = mealsForDay(date);
                    const dayChores = choresForDay(date);
                    const today = isTodayDate(date);
                    const d = new Date(date + 'T00:00:00');

                    return (
                        <div key={date}
                            className={`bg-surface-800 rounded-xl p-3 min-h-[200px] flex flex-col ${
                                today ? 'ring-2 ring-forest-500/50' : ''
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="cursor-pointer" onClick={() => { setTodayDate(date); setViewMode('today'); }}>
                                    <p className={`text-xs font-medium ${today ? 'text-forest-400' : 'text-surface-400'}`}>
                                        {DAY_NAMES[i]}
                                    </p>
                                    <p className={`text-lg font-bold ${today ? 'text-forest-300' : 'text-surface-200'}`}>
                                        {d.getDate()}
                                    </p>
                                </div>
                                <button onClick={() => openNewForm(date)}
                                    className="w-7 h-7 flex items-center justify-center bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-surface-200 rounded-lg text-sm transition-colors">
                                    +
                                </button>
                            </div>

                            <div className="space-y-1 flex-1 overflow-y-auto">
                                {dayEvents.map(event => (
                                    <button key={`e-${event.id}`} onClick={() => openEditEvent(event)}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer
                                            ${editingId === event.id && formType === 'event' ? 'ring-1 ring-ocean-400' : ''}
                                            bg-ocean-600/15 hover:bg-ocean-600/25 text-surface-200`}>
                                        <span className="mr-1">{TYPE_EMOJI[event.event_type] || '📌'}</span>
                                        <span className="text-ocean-300">{event.start_time?.slice(0, 5)}</span>
                                        <span className="ml-1 truncate">{event.title}</span>
                                    </button>
                                ))}
                                {dayMeals.map(meal => (
                                    <button key={`m-${meal.id}`} onClick={() => openEditMeal(meal)}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer
                                            ${editingId === meal.id && formType === 'meal' ? 'ring-1 ring-amber-400' : ''}
                                            bg-amber-600/15 hover:bg-amber-600/25 text-surface-200`}>
                                        <span className="mr-1">{MEAL_EMOJI[meal.meal_type] || '🍽️'}</span>
                                        <span className="truncate">{meal.recipe_name}</span>
                                    </button>
                                ))}
                                {dayChores.map(item => (
                                    <button key={`c-${item.chore.id}`} onClick={() => openEditChore(item)}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer
                                            ${editingId === item.chore.id && formType === 'chore' ? 'ring-1 ring-forest-400' : ''}
                                            ${item.completed
                                                ? 'bg-forest-600/10 text-surface-500 line-through'
                                                : 'bg-forest-600/15 hover:bg-forest-600/25 text-surface-200'
                                            }`}>
                                        <span className="mr-1">{item.completed ? '✅' : '🧹'}</span>
                                        <span className="truncate">{item.chore.title}</span>
                                    </button>
                                ))}
                                {dayEvents.length === 0 && dayMeals.length === 0 && dayChores.length === 0 && (
                                    <p className="text-xs text-surface-500 text-center py-4">No items</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-surface-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-ocean-600/30" /> Events</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600/30" /> Meals</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-forest-600/30" /> Chores</span>
            </div>
        </>
    );

    return (
        <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 transition-colors">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">📆 Calendar</h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex bg-surface-800 rounded-xl p-1 gap-1">
                        <button onClick={() => setViewMode('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                viewMode === 'today' ? 'bg-forest-600 text-white' : 'text-surface-400 hover:text-surface-200'
                            }`}>
                            Today
                        </button>
                        <button onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                viewMode === 'week' ? 'bg-forest-600 text-white' : 'text-surface-400 hover:text-surface-200'
                            }`}>
                            Week
                        </button>
                    </div>
                    <button onClick={() => setShowPresets('meal')}
                        className="px-3 py-2 bg-amber-600/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/30 rounded-xl text-xs font-medium transition-colors">
                        🍽️ Meal Presets
                    </button>
                    <button onClick={() => setShowPresets('chore')}
                        className="px-3 py-2 bg-forest-600/20 border border-forest-600/30 text-forest-300 hover:bg-forest-600/30 rounded-xl text-xs font-medium transition-colors">
                        🧹 Chore Presets
                    </button>
                </div>
            </div>

            {/* Navigation */}
            {viewMode === 'today' ? (
                <div className="flex items-center justify-center gap-4 mb-6">
                    <button onClick={prevDay} className="px-3 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-xl text-sm transition-colors">&larr;</button>
                    <button onClick={goToday}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                            isTodayActual
                                ? 'bg-forest-600/20 border border-forest-600/30 text-forest-300'
                                : 'bg-surface-800 hover:bg-surface-700 text-surface-200'
                        }`}>
                        {todayLabel}
                    </button>
                    <button onClick={nextDay} className="px-3 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-xl text-sm transition-colors">&rarr;</button>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-4 mb-6">
                    <button onClick={prevWeek} className="px-3 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-xl text-sm transition-colors">&larr;</button>
                    <button onClick={goToday} className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-xl text-sm font-medium transition-colors">
                        {weekLabel}
                    </button>
                    <button onClick={nextWeek} className="px-3 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-xl text-sm transition-colors">&rarr;</button>
                </div>
            )}

            {/* Form */}
            {showForm && renderForm()}

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading calendar...</div>
            ) : viewMode === 'today' ? renderTodayView() : renderWeekView()}

            {/* Preset browsers */}
            {showPresets === 'meal' && (
                <PresetBrowser type="meal" presets={MEAL_PRESETS} members={members}
                    onAdd={addFromPreset} onClose={() => setShowPresets(null)} />
            )}
            {showPresets === 'chore' && (
                <PresetBrowser type="chore" presets={CHORE_PRESETS} members={members}
                    onAdd={addFromPreset} onClose={() => setShowPresets(null)} />
            )}
        </div>
    );
}
