import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../context/HouseholdContext';
import { get, post, put, del } from '../hooks/useApi';

export default function SettingsView() {
    const navigate = useNavigate();
    const { members, refresh } = useHousehold();
    const [calendarStatus, setCalendarStatus] = useState({});
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [error, setError] = useState('');

    const connectCalendar = useCallback(async (member) => {
        setCalendarStatus((prev) => ({ ...prev, [member.id]: 'connecting' }));
        setError('');
        try {
            const { url } = await get(`/google-calendar/auth-url?member_id=${member.id}`);
            const popup = window.open(url, 'google-auth', 'width=500,height=600,left=200,top=100');

            const poll = setInterval(async () => {
                if (popup && popup.closed) {
                    clearInterval(poll);
                    try {
                        await post(`/google-calendar/sync/${member.id}`);
                        setCalendarStatus((prev) => ({ ...prev, [member.id]: 'connected' }));
                        refresh();
                    } catch {
                        setCalendarStatus((prev) => ({ ...prev, [member.id]: 'failed' }));
                    }
                }
            }, 1000);
        } catch (e) {
            setCalendarStatus((prev) => ({ ...prev, [member.id]: 'failed' }));
            setError(e.message);
        }
    }, [refresh]);

    const disconnectCalendar = useCallback(async (member) => {
        setError('');
        try {
            await del(`/google-calendar/disconnect/${member.id}`);
            setCalendarStatus((prev) => ({ ...prev, [member.id]: null }));
            refresh();
        } catch (e) {
            setError(e.message);
        }
    }, [refresh]);

    // ── Reminder config state ──────────────────────────────────────────────────
    const [reminderConfigs, setReminderConfigs] = useState({});   // keyed by member_id or 'global'
    const [reminderSaving, setReminderSaving] = useState({});
    const [reminderSaved, setReminderSaved] = useState({});

    useEffect(() => {
        get('/notifications/reminder-config').then(configs => {
            const map = {};
            configs.forEach(c => {
                map[c.member_id ?? 'global'] = { hour: c.reminder_hour, minute: c.reminder_minute, enabled: c.enabled };
            });
            setReminderConfigs(map);
        }).catch(() => { });
    }, []);

    const getReminderFor = (key) => reminderConfigs[key] ?? { hour: 18, minute: 0, enabled: true };

    const saveReminder = useCallback(async (memberId) => {
        const key = memberId ?? 'global';
        const cfg = getReminderFor(key);
        setReminderSaving(s => ({ ...s, [key]: true }));
        try {
            const qs = memberId != null ? `?member_id=${memberId}` : '';
            await put(`/notifications/reminder-config${qs}`, {
                reminder_hour: cfg.hour,
                reminder_minute: cfg.minute,
                enabled: cfg.enabled,
            });
            setReminderSaved(s => ({ ...s, [key]: true }));
            setTimeout(() => setReminderSaved(s => ({ ...s, [key]: false })), 2000);
        } catch {
            // silently fail — user can retry
        } finally {
            setReminderSaving(s => ({ ...s, [key]: false }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reminderConfigs]);

    const updateReminder = (key, patch) => {
        setReminderConfigs(prev => ({
            ...prev,
            [key]: { ...getReminderFor(key), ...patch },
        }));
    };

    const syncAll = useCallback(async () => {
        setSyncing(true);
        setSyncResult(null);
        setError('');
        try {
            const result = await post('/google-calendar/sync-all');
            setSyncResult(result);
            refresh();
        } catch (e) {
            setError(e.message);
        } finally {
            setSyncing(false);
        }
    }, [refresh]);

    const hasAnyConnected = members.some(m => m.google_credentials);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <button onClick={() => navigate('/')}
                    className="text-surface-400 hover:text-surface-200 text-sm mb-4 flex items-center gap-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
                <h1 className="text-2xl md:text-3xl font-bold text-surface-100">Settings</h1>
            </header>

            {/* Google Calendar Section */}
            <section className="bg-surface-800/60 rounded-2xl border border-surface-700/50 p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                            <svg className="w-5 h-5 text-ocean-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Google Calendar
                        </h2>
                        <p className="text-surface-400 text-sm mt-1">
                            Connect calendars to sync events automatically every hour.
                        </p>
                    </div>

                    {hasAnyConnected && (
                        <button
                            onClick={syncAll}
                            disabled={syncing}
                            className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300
                                hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors
                                min-h-[48px] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center gap-2"
                        >
                            {syncing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-ocean-400/30 border-t-ocean-400 rounded-full animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Sync Now
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Sync result banner */}
                {syncResult && (
                    <div className="mb-4 p-3 bg-forest-600/10 border border-forest-600/30 rounded-xl">
                        <p className="text-forest-400 text-sm font-medium">
                            Synced {syncResult.synced} calendar{syncResult.synced !== 1 ? 's' : ''}
                            {syncResult.results && syncResult.results.length > 0 && (
                                <span className="text-surface-400 font-normal">
                                    {' '}&mdash;{' '}
                                    {syncResult.results
                                        .filter(r => !r.error)
                                        .reduce((acc, r) => acc + r.imported + r.updated, 0)} events updated,{' '}
                                    {syncResult.results
                                        .filter(r => !r.error)
                                        .reduce((acc, r) => acc + r.exported, 0)} exported
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-rose-600/10 border border-rose-600/30 rounded-xl">
                        <p className="text-rose-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Member list */}
                <div className="space-y-3">
                    {members.map((m) => {
                        const status = calendarStatus[m.id];
                        const isConnected = status === 'connected' || m.google_credentials;
                        const isConnecting = status === 'connecting';
                        const isFailed = status === 'failed';
                        const isDisconnected = status === null && !m.google_credentials;

                        return (
                            <div key={m.id}
                                className="flex items-center justify-between p-4 bg-surface-700/50 rounded-xl border border-surface-600/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{m.avatar || '👤'}</span>
                                    <div>
                                        <span className="text-surface-100 font-medium">{m.name}</span>
                                        <span className="text-surface-500 text-xs ml-2 capitalize">{m.role}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isConnected && !isDisconnected ? (
                                        <>
                                            <span className="flex items-center gap-1.5 text-forest-400 text-sm font-medium mr-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Connected
                                            </span>
                                            <button
                                                onClick={() => disconnectCalendar(m)}
                                                className="px-3 py-2 bg-surface-600 hover:bg-rose-600/20 hover:text-rose-400
                                                    text-surface-400 rounded-xl text-xs font-medium transition-colors min-h-[48px]"
                                            >
                                                Disconnect
                                            </button>
                                        </>
                                    ) : isConnecting ? (
                                        <span className="text-amber-400 text-sm flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                            Connecting...
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => connectCalendar(m)}
                                            className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-surface-200 rounded-xl text-sm
                                                font-medium transition-colors flex items-center gap-2 min-h-[48px] active:scale-[0.97]"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a.75.75 0 01-.75-.75v-3.75H7.5a.75.75 0 010-1.5h3.75V7.5a.75.75 0 011.5 0v3.75h3.75a.75.75 0 010 1.5h-3.75v3.75a.75.75 0 01-.75.75z" />
                                            </svg>
                                            {isFailed ? 'Retry' : 'Connect'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Auto-sync info */}
                {hasAnyConnected && (
                    <div className="mt-4 flex items-center gap-2 text-surface-500 text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Auto-syncs every hour in the background
                    </div>
                )}
            </section>

            {/* Reminder Notifications Section */}
            <section className="bg-surface-800/60 rounded-2xl border border-surface-700/50 p-6 mb-6">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                        Daily Goal Reminders
                    </h2>
                    <p className="text-surface-400 text-sm mt-1">
                        Get an in-app nudge if daily goals haven't been completed by the configured time.
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Global default row */}
                    <ReminderRow
                        label="Global default"
                        sublabel="Applies to members without a personal override"
                        cfg={getReminderFor('global')}
                        saving={!!reminderSaving['global']}
                        saved={!!reminderSaved['global']}
                        onChange={(patch) => updateReminder('global', patch)}
                        onSave={() => saveReminder(null)}
                    />

                    {/* Per-member rows */}
                    {members.map(m => (
                        <ReminderRow
                            key={m.id}
                            label={m.name}
                            sublabel={`Override for ${m.name}`}
                            avatar={m.avatar}
                            cfg={getReminderFor(m.id)}
                            saving={!!reminderSaving[m.id]}
                            saved={!!reminderSaved[m.id]}
                            onChange={(patch) => updateReminder(m.id, patch)}
                            onSave={() => saveReminder(m.id)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function ReminderRow({ label, sublabel, avatar, cfg, saving, saved, onChange, onSave }) {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = [0, 15, 30, 45];

    const fmt12 = (h) => {
        const period = h < 12 ? 'AM' : 'PM';
        const display = h % 12 === 0 ? 12 : h % 12;
        return `${display} ${period}`;
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-700/50 rounded-xl border border-surface-600/50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {avatar && <span className="text-xl shrink-0">{avatar}</span>}
                <div className="min-w-0">
                    <p className="text-surface-100 font-medium text-sm truncate">{label}</p>
                    <p className="text-surface-500 text-xs truncate">{sublabel}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {/* Enabled toggle */}
                <button
                    onClick={() => onChange({ enabled: !cfg.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${cfg.enabled ? 'bg-forest-600' : 'bg-surface-600'}`}
                    title={cfg.enabled ? 'Disable reminders' : 'Enable reminders'}
                >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                        ${cfg.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>

                {/* Hour select */}
                <select
                    value={cfg.hour}
                    disabled={!cfg.enabled}
                    onChange={e => onChange({ hour: parseInt(e.target.value) })}
                    className="bg-surface-600 border border-surface-500 text-surface-200 rounded-lg px-2 py-1.5 text-sm
                        disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-ocean-500"
                >
                    {hours.map(h => (
                        <option key={h} value={h}>{fmt12(h)}</option>
                    ))}
                </select>

                {/* Minute select */}
                <select
                    value={cfg.minute}
                    disabled={!cfg.enabled}
                    onChange={e => onChange({ minute: parseInt(e.target.value) })}
                    className="bg-surface-600 border border-surface-500 text-surface-200 rounded-lg px-2 py-1.5 text-sm
                        disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-ocean-500"
                >
                    {minutes.map(m => (
                        <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>
                    ))}
                </select>

                {/* Save button */}
                <button
                    onClick={onSave}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]
                        ${saved
                            ? 'bg-forest-600/20 text-forest-400 border border-forest-600/30'
                            : 'bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
                </button>
            </div>
        </div>
    );
}
