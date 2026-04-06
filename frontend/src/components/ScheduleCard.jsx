import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function ScheduleCard() {
    const { schedule, members } = useHousehold();
    const navigate = useNavigate();
    const events = schedule?.events || [];
    const freeBlocks = schedule?.free_blocks || [];

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/schedule')}
            style={{ animationDelay: '0.1s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">📅</span> Today's Schedule
                </h3>
                <span className="text-xs text-surface-400">{events.length} events</span>
            </div>

            {events.length === 0 ? (
                <p className="text-surface-400 text-sm">No events scheduled today</p>
            ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {events.map((event, i) => {
                        const firstMember = event.assigned_member_ids?.length > 0
                            ? members.find(m => m.id === event.assigned_member_ids[0])
                            : null;
                        const borderColor = firstMember?.color
                            || (event.is_protected ? '#2a8c56' : '#313b48');
                        return (
                            <div
                                key={event.id || i}
                                className="flex overflow-hidden rounded-lg text-sm bg-surface-700/50"
                            >
                                <div className="w-[4px] shrink-0" style={{ backgroundColor: borderColor }} />
                                <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
                                    <span className="text-xs text-surface-400 font-mono w-20 shrink-0">
                                        {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                                    </span>
                                    <span className="truncate text-surface-200">{event.title}</span>
                                    {event.is_protected && (
                                        <span className="ml-auto text-forest-400 text-xs shrink-0">🛡️</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {freeBlocks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-700">
                    <p className="text-xs text-forest-400 mb-1">
                        {freeBlocks.length} free block{freeBlocks.length > 1 ? 's' : ''} available
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        {freeBlocks.slice(0, 3).map((b, i) => (
                            <span key={i} className="text-sm bg-forest-900/30 text-forest-300 px-3 py-2 rounded-lg">
                                {b.start?.slice(0, 5)} – {b.end?.slice(0, 5)} ({b.duration_min}m)
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
