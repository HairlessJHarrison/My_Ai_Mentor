import { useState, useRef, useEffect, useCallback } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { put, del } from '../hooks/useApi';

const TYPE_ICONS = {
    goal_reminder: '🎯',
    achievement: '🏆',
    info: 'ℹ️',
};

const TYPE_COLORS = {
    goal_reminder: '#2a8c56',  // forest-600
    achievement: '#f59e0b',    // amber-500
    info: '#1a7ef5',           // ocean-500
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
    const { notifications, markNotificationRead, markAllNotificationsRead, removeNotification } = useHousehold();
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const unread = notifications.filter(n => !n.read).length;

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const handleMarkRead = useCallback(async (id) => {
        await put(`/notifications/${id}/read`);
        markNotificationRead(id);
    }, [markNotificationRead]);

    const handleMarkAllRead = useCallback(async () => {
        await put('/notifications/read-all');
        markAllNotificationsRead();
    }, [markAllNotificationsRead]);

    const handleDelete = useCallback(async (e, id) => {
        e.stopPropagation();
        await del(`/notifications/${id}`);
        removeNotification(id);
    }, [removeNotification]);

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2.5 bg-surface-700/50 border border-surface-600/50 text-surface-400
                    hover:text-surface-200 hover:bg-surface-700 rounded-xl transition-colors
                    min-h-[48px] min-w-[48px] flex items-center justify-center active:scale-[0.97]"
                title="Notifications"
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                        bg-rose-500 text-white text-[10px] font-bold rounded-full
                        flex items-center justify-center leading-none">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-[480px] flex flex-col
                    bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50">
                        <h3 className="text-sm font-semibold text-surface-100">Notifications</h3>
                        {unread > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-ocean-400 hover:text-ocean-300 transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center">
                                <p className="text-surface-500 text-sm">No notifications</p>
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-2 p-2">
                                {notifications.map(n => {
                                    const borderColor = TYPE_COLORS[n.type] || '#4a5568';
                                    return (
                                        <li
                                            key={n.id}
                                            onClick={() => !n.read && handleMarkRead(n.id)}
                                            className={`flex overflow-hidden rounded-lg shadow-sm transition-colors group
                                                ${n.read
                                                    ? 'opacity-60'
                                                    : 'cursor-pointer bg-surface-700/30 hover:bg-surface-700/50'
                                                }`}
                                        >
                                            {/* Left color border */}
                                            <div className="w-[4px] shrink-0 rounded-l-lg" style={{ backgroundColor: borderColor }} />
                                            <div className="flex items-start gap-3 px-3 py-2.5 flex-1 min-w-0">
                                                <span className="text-base mt-0.5 shrink-0">
                                                    {TYPE_ICONS[n.type] || '🔔'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-surface-200 leading-snug">{n.message}</p>
                                                    <p className="text-xs text-surface-500 mt-0.5">{timeAgo(n.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 self-center">
                                                    {!n.read && (
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: borderColor }} />
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(e, n.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-surface-500
                                                            hover:text-rose-400 rounded transition-all"
                                                        title="Dismiss"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
