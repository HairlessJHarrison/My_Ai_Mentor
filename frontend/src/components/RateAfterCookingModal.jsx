import { useState } from 'react';
import { post } from '../hooks/useApi';
import StarRating from './StarRating';

/**
 * RateAfterCookingModal — shown after a meal is marked as cooked.
 * Lets each family member rate the meal (1-5 stars) with an optional comment.
 *
 * Props:
 *   meal       {object}   MealPlan object (needs .recipe_id and .recipe_name)
 *   members    {array}    [{id, name, color}]
 *   onClose    {function} close without saving
 *   onDone     {function} called after ratings are saved
 */
export default function RateAfterCookingModal({ meal, members, onClose, onDone }) {
    const [ratings, setRatings] = useState({});
    const [comments, setComments] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const setMemberRating = (memberId, value) =>
        setRatings(prev => ({ ...prev, [memberId]: value }));

    const setMemberComment = (memberId, value) =>
        setComments(prev => ({ ...prev, [memberId]: value }));

    const handleSubmit = async () => {
        const recipeId = meal.recipe_id;
        if (!recipeId) {
            // If no recipe_id, close without rating (shouldn't happen in practice)
            onDone?.();
            return;
        }

        const ratingEntries = Object.entries(ratings).filter(([, v]) => v != null);
        if (ratingEntries.length === 0) {
            onDone?.();
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await Promise.all(
                ratingEntries.map(([memberId, rating]) =>
                    post(`/recipes/${recipeId}/ratings`, {
                        member_id: parseInt(memberId),
                        rating,
                        comment: comments[memberId] || null,
                    })
                )
            );
            onDone?.();
        } catch (e) {
            setError('Failed to save ratings. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const ratedCount = Object.values(ratings).filter(Boolean).length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-surface-800 rounded-2xl p-6 max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="text-center mb-5">
                    <div className="text-3xl mb-2">🍽️</div>
                    <h2 className="text-lg font-bold text-surface-100">How was dinner?</h2>
                    <p className="text-sm text-surface-400 mt-1 truncate">{meal.recipe_name}</p>
                </div>

                {/* Per-member rating rows */}
                <div className="space-y-4">
                    {members.map(member => (
                        <div key={member.id} className="bg-surface-700/50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: member.color }}
                                />
                                <span className="text-sm font-medium text-surface-200">{member.name}</span>
                            </div>
                            <StarRating
                                value={ratings[member.id] ?? null}
                                onChange={v => setMemberRating(member.id, v)}
                                size="lg"
                                showLabel
                            />
                            {ratings[member.id] && (
                                <input
                                    type="text"
                                    placeholder="Any comments? (optional)"
                                    value={comments[member.id] || ''}
                                    onChange={e => setMemberComment(member.id, e.target.value)}
                                    className="w-full bg-surface-700 text-surface-100 text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-forest-500 placeholder:text-surface-500"
                                />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <p className="mt-3 text-sm text-rose-400 text-center">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97] transition-transform"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || ratedCount === 0}
                        className="flex-1 px-4 py-3 bg-forest-600 hover:bg-forest-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97] transition-all"
                    >
                        {saving ? 'Saving…' : ratedCount > 0 ? `Save ${ratedCount} rating${ratedCount > 1 ? 's' : ''}` : 'Rate first'}
                    </button>
                </div>
            </div>
        </div>
    );
}
