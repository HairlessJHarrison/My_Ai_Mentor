/**
 * PreferenceBadges — shows each member's preference for a recipe.
 * Tapping a badge cycles: none → loved → liked → disliked → none.
 *
 * Props:
 *   recipeId     {number}   recipe to show/set preferences for
 *   members      {array}    [{id, name, color}]
 *   preferences  {array}    [{member_id, preference, is_favorite}] from API
 *   onSet        {function} called with (memberId, newPreference) — null to clear
 *   readonly     {boolean}  display-only
 */

const CYCLE = [null, 'loved', 'liked', 'disliked'];

const PREF_CONFIG = {
    loved:    { icon: '❤️',  label: 'Loved it',  bg: 'bg-rose-500/20',   border: 'border-rose-500/40',   text: 'text-rose-300' },
    liked:    { icon: '👍',  label: 'Liked it',  bg: 'bg-forest-500/20', border: 'border-forest-500/40', text: 'text-forest-300' },
    disliked: { icon: '👎',  label: 'Disliked',  bg: 'bg-surface-600/40', border: 'border-surface-500/40', text: 'text-surface-400' },
};

export default function PreferenceBadges({ members = [], preferences = [], onSet, readonly = false }) {
    const prefMap = {};
    preferences.forEach(p => { prefMap[p.member_id] = p.preference; });

    const handleTap = (memberId) => {
        if (readonly) return;
        const current = prefMap[memberId] ?? null;
        const idx = CYCLE.indexOf(current);
        const next = CYCLE[(idx + 1) % CYCLE.length];
        onSet?.(memberId, next);
    };

    if (members.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {members.map(member => {
                const pref = prefMap[member.id] ?? null;
                const cfg = PREF_CONFIG[pref];

                return (
                    <button
                        key={member.id}
                        type="button"
                        onClick={() => handleTap(member.id)}
                        disabled={readonly}
                        className={`
                            inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border
                            transition-all active:scale-95
                            ${readonly ? 'cursor-default' : 'cursor-pointer hover:brightness-110'}
                            ${cfg
                                ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                                : 'bg-surface-700/40 border-surface-600/40 text-surface-500'
                            }
                        `}
                        title={`${member.name}: ${cfg?.label ?? 'No preference — tap to set'}`}
                    >
                        <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: member.color }}
                        />
                        <span>{cfg ? cfg.icon : '·'}</span>
                        <span className="hidden sm:inline">{member.name.split(' ')[0]}</span>
                    </button>
                );
            })}
        </div>
    );
}
