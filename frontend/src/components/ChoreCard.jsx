import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';

export default function ChoreCard() {
    const { chores, members } = useHousehold();
    const navigate = useNavigate();

    // Aggregate chore status across all members
    const membersList = chores?.members || [];
    const allChoreItems = membersList.flatMap(m => m.chores || []);
    const totalChores = allChoreItems.length;
    const completedChores = allChoreItems.filter(c => c.completed).length;

    const progressPercent = totalChores > 0 ? (completedChores / totalChores) * 100 : 0;

    // Find uncompleted chores (deduplicated by chore id), keeping member info for color
    const seen = new Set();
    const uncompleted = [];
    for (const memberEntry of membersList) {
        const member = members.find(m => m.id === memberEntry.member_id);
        for (const item of (memberEntry.chores || [])) {
            if (!item.completed && !seen.has(item.chore.id)) {
                seen.add(item.chore.id);
                uncompleted.push({ chore: item.chore, member });
            }
        }
    }

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/chores')}
            style={{ animationDelay: '0.6s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">🧹</span> Chores
                </h3>
                <span className="text-xs text-surface-400">Today</span>
            </div>

            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-surface-300">
                        {totalChores === 0 ? 'No chores assigned' : `${completedChores} of ${totalChores} done`}
                    </p>
                    {totalChores > 0 && (
                        <span className="text-sm font-medium text-amber-400">{Math.round(progressPercent)}%</span>
                    )}
                </div>
                {totalChores > 0 && (
                    <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-forest-600 to-forest-400 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
            </div>

            {uncompleted.length > 0 && (
                <div className="space-y-1.5">
                    {uncompleted.slice(0, 3).map(({ chore, member }, i) => {
                        const borderColor = member?.color || '#313b48';
                        return (
                            <div key={chore.id || i} className="flex overflow-hidden rounded-lg text-sm bg-surface-700/40">
                                <div className="w-[4px] shrink-0 rounded-l-lg" style={{ backgroundColor: borderColor }} />
                                <div className="flex items-center justify-between px-3 py-2.5 flex-1 min-w-0">
                                    <span className="text-surface-300 truncate">{chore.title}</span>
                                    <span className="text-amber-400 ml-2 shrink-0">+{chore.points} pts</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {totalChores > 0 && completedChores === totalChores && (
                <p className="text-xs text-forest-400 font-medium text-center mt-2">All done today!</p>
            )}
        </div>
    );
}
