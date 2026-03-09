import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, del } from '../hooks/useApi';

export default function ScheduleView() {
    const navigate = useNavigate();
    const [data, setData] = useState({ events: [], free_blocks: [] });
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        title: '', date: new Date().toISOString().slice(0, 10),
        start_time: '09:00', end_time: '10:00', event_type: 'other',
        household_id: 'default',
    });

    useEffect(() => {
        Promise.all([get('/schedules/week'), get('/members')])
            .then(([d, m]) => { setData(d); setMembers(m); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const createEvent = async (e) => {
        e.preventDefault();
        try {
            await post('/schedules/events', {
                ...form,
                start_time: form.start_time + ':00',
                end_time: form.end_time + ':00',
            });
            const updated = await get('/schedules/week');
            setData(updated);
            setShowForm(false);
            setForm({ title: '', date: new Date().toISOString().slice(0, 10), start_time: '09:00', end_time: '10:00', event_type: 'other', household_id: 'default' });
        } catch (err) {
            alert(err.message);
        }
    };

    const deleteEvent = async (id) => {
        if (!confirm('Delete this event?')) return;
        try {
            await del(`/schedules/events/${id}`);
            setData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
        } catch (err) {
            alert(err.message);
        }
    };

    const eventTypes = ['appointment', 'work', 'school', 'social', 'errand', 'protected_time', 'other'];
    const typeEmoji = { appointment: '📋', work: '💼', school: '🎓', social: '🤝', errand: '🏃', protected_time: '🛡️', other: '📌' };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 transition-colors">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">📅 Schedule</h1>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    + New Event
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <form onSubmit={createEvent} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Event title" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500">
                            {eventTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </select>
                        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        <div className="flex gap-2">
                            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                                className="flex-1 bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)}
                            className="px-4 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm">Cancel</button>
                        <button type="submit"
                            className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium">Create</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading schedule...</div>
            ) : (
                <div className="space-y-3">
                    {data.events.length === 0 ? (
                        <div className="text-center py-12 text-surface-400">No events this week. Add one above!</div>
                    ) : (
                        data.events.map((event) => (
                            <div key={event.id}
                                className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-colors ${event.is_protected ? 'bg-forest-900/30 border border-forest-700/30' : 'bg-surface-800'
                                    }`}>
                                <span className="text-xl">{typeEmoji[event.event_type] || '📌'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-surface-100 truncate">{event.title}</p>
                                    <p className="text-xs text-surface-400">
                                        {event.date} · {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                                        <span className="ml-2 capitalize">{event.event_type.replace(/_/g, ' ')}</span>
                                    </p>
                                    {(event.location || event.travel_time_min) && (
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            {event.location && <><span className="text-forest-400">📍</span> {event.location}</>}
                                            {event.travel_time_min && <span className="ml-2 text-amber-400/70">~{event.travel_time_min}m drive</span>}
                                        </p>
                                    )}
                                </div>
                                {/* Member color dots */}
                                {event.assigned_member_ids?.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                        {event.assigned_member_ids.map(id => {
                                            const m = members.find(mem => mem.id === id);
                                            return m ? <span key={id} className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} title={m.name} /> : null;
                                        })}
                                    </div>
                                )}
                                {event.is_protected && <span className="text-forest-400 text-xs font-medium">Protected</span>}
                                <button onClick={() => deleteEvent(event.id)}
                                    className="text-surface-500 hover:text-rose-400 transition-colors text-sm">✕</button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Free blocks */}
            {data.free_blocks.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-lg font-semibold text-surface-100 mb-3">🌿 Free Time Blocks</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.free_blocks.map((block, i) => (
                            <div key={i} className="px-4 py-3 bg-forest-900/20 border border-forest-800/30 rounded-xl text-sm">
                                <span className="text-forest-300">{block.date}</span>
                                <span className="text-surface-400 mx-2">·</span>
                                <span className="text-surface-200">{block.start?.slice(0, 5)} – {block.end?.slice(0, 5)}</span>
                                <span className="text-surface-400 ml-2">({block.duration_min}m)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
