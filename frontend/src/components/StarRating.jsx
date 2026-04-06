/**
 * StarRating — tap-to-rate 1-5 star widget.
 *
 * Props:
 *   value        {number|null}  current rating (1-5) or null
 *   onChange     {function}     called with new rating (1-5)
 *   readonly     {boolean}      display-only mode
 *   size         {'sm'|'md'|'lg'}  star size (default 'md')
 *   showLabel    {boolean}      show numeric label alongside stars
 */
export default function StarRating({ value, onChange, readonly = false, size = 'md', showLabel = false }) {
    const sizeClass = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' }[size] || 'text-xl';
    const gapClass = { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-1.5' }[size] || 'gap-1';

    const labels = ['', 'Terrible', 'Bad', 'OK', 'Good', 'Loved it!'];

    return (
        <div className={`flex items-center ${gapClass}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    onClick={() => !readonly && onChange?.(star)}
                    className={`
                        ${sizeClass} leading-none transition-transform
                        ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125 active:scale-110'}
                        ${star <= (value || 0) ? 'text-amber-400' : 'text-surface-600'}
                    `}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                    ★
                </button>
            ))}
            {showLabel && value && (
                <span className="ml-1 text-xs text-surface-400">{labels[value]}</span>
            )}
        </div>
    );
}
