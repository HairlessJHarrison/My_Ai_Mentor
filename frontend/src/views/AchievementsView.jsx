import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import { useHousehold } from '../context/HouseholdContext';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import MemberCard from '../components/MemberCard';
import PointsHistoryChart from '../components/PointsHistoryChart';

const RENEWAL_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };

export default function AchievementsView() {
    const navigate = useNavigate();
    const { config, members, selectedMemberId: selectedMember } = useHousehold();
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [logData, setLogData] = useState(null);
    const [logLoading, setLogLoading] = useState(false);
    const [claimsData, setClaimsData] = useState(null);
    const [claimsLoading, setClaimsLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [pinEntryMode, setPinEntryMode] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingClaimId, setPendingClaimId] = useState(null);
    const [form, setForm] = useState({
        prize_name: '', target_points: 100, prize_image_url: '',
        renewable: false, renewal_period: '',
    });

    const prefs = config?.preferences || {};
    const actualPin = prefs.parent_pin || null;

    useEffect(() => {
        if (!selectedMember) return;
        setLoading(true);
        get(`/achievements?member_id=${selectedMember}`)
            .then(setAchievements)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedMember]);

    const refreshAchievements = async () => {
        if (!selectedMember) return;
        const a = await get(`/achievements?member_id=${selectedMember}`);
        setAchievements(a);
    };

    const openNewForm = () => {
        setEditingId(null);
        setForm({ prize_name: '', target_points: 100, prize_image_url: '', renewable: false, renewal_period: '' });
        setShowForm(true);
    };

    const openEditForm = (ach) => {
        setEditingId(ach.id);
        setForm({
            prize_name: ach.prize_name,
            target_points: ach.target_points,
            prize_image_url: ach.prize_image_url || '',
            renewable: ach.renewable || false,
            renewal_period: ach.renewal_period || '',
        });
        setShowForm(true);
    };

    const submitForm = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                prize_name: form.prize_name,
                target_points: parseInt(form.target_points),
                prize_image_url: form.prize_image_url || null,
                renewable: form.renewable,
                renewal_period: form.renewable && form.renewal_period ? form.renewal_period : null,
            };
            if (editingId) {
                await put(`/achievements/${editingId}`, payload);
            } else {
                await post('/achievements', {
                    household_id: 'default',
                    member_id: selectedMember,
                    ...payload,
                });
            }
            await refreshAchievements();
            setShowForm(false);
            setEditingId(null);
        } catch (err) { alert(err.message); }
    };

    const deleteAchievement = async (id) => {
        if (!confirm('Remove this achievement?')) return;
        try {
            await del(`/achievements/${id}`);
            await refreshAchievements();
        } catch (err) { alert(err.message); }
    };

    const startClaim = (id) => {
        if (actualPin) {
            setPendingClaimId(id);
            setPinInput('');
            setPinError('');
            setPinEntryMode(true);
        } else {
            claimAchievement(id);
        }
    };

    const verifyPin = () => {
        if (pinInput === actualPin) {
            setPinEntryMode(false);
            claimAchievement(pendingClaimId);
        } else {
            setPinError('Incorrect PIN');
        }
    };

    const claimAchievement = async (id) => {
        try {
            await post(`/achievements/${id}/claim`);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
            await refreshAchievements();
            // Refresh claims panel if open
            if (expandedId === id && claimsData) {
                const c = await get(`/achievements/${id}/claims`);
                setClaimsData(c);
            }
        } catch (err) { alert(err.message); }
    };

    const toggleLog = async (id) => {
        if (expandedId === id) {
            setExpandedId(null);
            setLogData(null);
            setClaimsData(null);
            return;
        }
        setExpandedId(id);
        setLogData(null);
        setClaimsData(null);
        setLogLoading(true);
        try {
            const data = await get(`/achievements/${id}/progress`);
            setLogData(data);
        } catch (err) { console.error(err); }
        finally { setLogLoading(false); }
    };

    const loadClaimHistory = async (id) => {
        setClaimsLoading(true);
        try {
            const data = await get(`/achievements/${id}/claims`);
            setClaimsData(data);
        } catch (err) { console.error(err); }
        finally { setClaimsLoading(false); }
    };

    const activeAchievements = achievements.filter(a => a.is_active && !a.is_claimed);
    const claimedAchievements = achievements.filter(a => a.is_claimed || !a.is_active);
    const selectedMemberData = members.find(m => m.id === selectedMember);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} className="fixed inset-0 z-50 pointer-events-none" />}

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🏆 Achievements</h1>
                </div>
                <button onClick={openNewForm}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                    + New Achievement
                </button>
            </div>

            {/* Points history chart */}
            {selectedMember && <div className="mb-6"><PointsHistoryChart memberId={selectedMember} /></div>}

            {/* Create/Edit form */}
            <AnimatePresence>
                {showForm && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        onSubmit={submitForm} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4 overflow-hidden"
                    >
                        <h3 className="text-lg font-semibold text-surface-100">
                            {editingId ? 'Edit Achievement' : 'New Achievement'}
                            {selectedMemberData && <span className="text-sm text-surface-400 ml-2">for {selectedMemberData.name}</span>}
                        </h3>
                        <input type="text" value={form.prize_name} onChange={e => setForm(f => ({ ...f, prize_name: e.target.value }))}
                            placeholder="Prize name (e.g. New Bike, Trip to the Zoo)" required
                            className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-surface-400 mb-1">Points Goal</label>
                                <input type="number" value={form.target_points}
                                    onChange={e => setForm(f => ({ ...f, target_points: e.target.value }))}
                                    min="10" required
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs text-surface-400 mb-1">Prize Image URL (optional)</label>
                                <input type="url" value={form.prize_image_url}
                                    onChange={e => setForm(f => ({ ...f, prize_image_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                            </div>
                        </div>

                        {/* Renewable toggle */}
                        <div className="flex items-center gap-4 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div
                                    onClick={() => setForm(f => ({ ...f, renewable: !f.renewable }))}
                                    className={`relative w-10 h-6 rounded-full transition-colors ${form.renewable ? 'bg-forest-600' : 'bg-surface-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.renewable ? 'translate-x-5' : 'translate-x-1'}`} />
                                </div>
                                <span className="text-sm text-surface-300">Renewable</span>
                            </label>
                            {form.renewable && (
                                <select
                                    value={form.renewal_period}
                                    onChange={e => setForm(f => ({ ...f, renewal_period: e.target.value }))}
                                    className="bg-surface-700 text-surface-100 rounded-xl px-3 py-2 text-sm outline-none"
                                >
                                    <option value="">No period</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            )}
                            {form.renewable && (
                                <p className="text-xs text-surface-500">Resets progress after each claim so it can be earned again.</p>
                            )}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                                className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">Cancel</button>
                            <button type="submit"
                                className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[48px] active:scale-[0.97]">
                                {editingId ? 'Save Changes' : 'Create Achievement'}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Active achievements */}
            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading achievements...</div>
            ) : activeAchievements.length === 0 ? (
                <div className="text-center py-12 text-surface-400">
                    No active achievements. Create one above!
                </div>
            ) : (
                <div className="space-y-4">
                    {activeAchievements.map(ach => {
                        const percent = ach.percent || 0;
                        const pointsEarned = ach.points_earned || 0;
                        const isExpanded = expandedId === ach.id;

                        return (
                            <MemberCard key={ach.id} color={selectedMemberData?.color}>
                                <div className="p-5">
                                    <div className="flex items-center gap-4">
                                        {/* Progress circle */}
                                        <div className="relative w-20 h-20 shrink-0">
                                            <div className="absolute inset-0 bg-surface-700/50 rounded-full border-2 border-surface-700 overflow-hidden">
                                                <motion.div
                                                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-amber-600 to-amber-400 opacity-30"
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${percent}%` }}
                                                    transition={{ duration: 1, type: "spring", bounce: 0.3 }}
                                                />
                                                {ach.prize_image_url ? (
                                                    <img src={ach.prize_image_url} alt="Prize" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                                                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                ) : null}
                                                <span className="absolute inset-0 flex items-center justify-center text-2xl opacity-40">🎁</span>
                                            </div>
                                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="44" fill="none" stroke="transparent" strokeWidth="6" />
                                                <motion.circle
                                                    cx="50" cy="50" r="44" fill="none"
                                                    stroke="var(--color-amber-400)" strokeWidth="6"
                                                    strokeLinecap="round"
                                                    initial={{ strokeDasharray: "0 276" }}
                                                    animate={{ strokeDasharray: `${(percent / 100) * 276} 276` }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center drop-shadow-md">
                                                <span className="text-sm font-bold text-white leading-none">{pointsEarned}</span>
                                                <span className="text-[8px] text-white/70">/ {ach.target_points}</span>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-surface-100 font-semibold text-lg truncate">{ach.prize_name}</h3>
                                                {ach.renewable && (
                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-forest-600/20 text-forest-400 rounded-md font-medium">
                                                        🔄 {ach.renewal_period ? RENEWAL_LABELS[ach.renewal_period] : 'Renewable'}
                                                    </span>
                                                )}
                                                {ach.claim_count > 0 && (
                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-md font-medium">
                                                        ×{ach.claim_count} claimed
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-surface-400 mt-0.5">
                                                {percent >= 100 ? 'Goal reached!' : `${ach.target_points - pointsEarned} pts to go`}
                                            </p>
                                            <div className="w-full bg-surface-700 rounded-full h-1.5 mt-2">
                                                <motion.div
                                                    className="bg-amber-500 h-1.5 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percent}%` }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                />
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 shrink-0">
                                            {percent >= 100 ? (
                                                <button onClick={() => startClaim(ach.id)}
                                                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition-colors min-h-[48px] active:scale-[0.97]">
                                                    {ach.renewable ? '🔄 Claim & Reset' : 'Claim'}
                                                </button>
                                            ) : null}
                                            <div className="flex gap-1">
                                                <button onClick={() => toggleLog(ach.id)} title="View log"
                                                    className={`min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors rounded-lg active:scale-[0.97] ${isExpanded ? 'text-surface-200' : 'text-surface-400 hover:text-surface-200'}`}>
                                                    📋
                                                </button>
                                                {ach.renewable && (
                                                    <button
                                                        onClick={async () => {
                                                            if (expandedId !== ach.id) {
                                                                setExpandedId(ach.id);
                                                                setLogData(null);
                                                            }
                                                            await loadClaimHistory(ach.id);
                                                        }}
                                                        title="Claim history"
                                                        className="min-h-[48px] min-w-[48px] flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors rounded-lg active:scale-[0.97]">
                                                        🕐
                                                    </button>
                                                )}
                                                <button onClick={() => openEditForm(ach)} title="Edit"
                                                    className="min-h-[48px] min-w-[48px] flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors rounded-lg active:scale-[0.97]">
                                                    ✏️
                                                </button>
                                                <button onClick={() => deleteAchievement(ach.id)} title="Remove"
                                                    className="min-h-[48px] min-w-[48px] flex items-center justify-center text-surface-400 hover:text-rose-400 transition-colors rounded-lg active:scale-[0.97]">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded panel: point log or claim history */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-surface-700 overflow-hidden"
                                        >
                                            <div className="p-5 max-h-64 overflow-y-auto">
                                                {/* Claim history panel */}
                                                {claimsData ? (
                                                    <>
                                                        <h4 className="text-sm font-semibold text-surface-200 mb-3">
                                                            Claim History ({claimsData.claim_count})
                                                        </h4>
                                                        {claimsLoading ? (
                                                            <p className="text-xs text-surface-500">Loading...</p>
                                                        ) : claimsData.claims.length === 0 ? (
                                                            <p className="text-xs text-surface-500">Not claimed yet.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {claimsData.claims.map((c, i) => (
                                                                    <div key={c.id} className="flex items-center justify-between p-2.5 bg-surface-700/40 rounded-xl text-sm">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs">🏆</span>
                                                                            <div>
                                                                                <p className="text-surface-300 text-xs font-medium">Claim #{claimsData.claim_count - i}</p>
                                                                                <p className="text-[10px] text-surface-500">{new Date(c.claimed_at).toLocaleDateString()}</p>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-amber-400 font-bold text-sm">{c.points_at_claim} pts</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button onClick={() => setClaimsData(null)} className="mt-3 text-xs text-surface-500 hover:text-surface-300">
                                                            Show point log instead
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <h4 className="text-sm font-semibold text-surface-200 mb-3">Point History</h4>
                                                        {logLoading ? (
                                                            <p className="text-xs text-surface-500">Loading...</p>
                                                        ) : logData?.log?.length === 0 ? (
                                                            <p className="text-xs text-surface-500">No points earned yet. Complete chores and goals!</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {logData?.log?.map((entry) => (
                                                                    <div key={`${entry.type}-${entry.id}`} className="flex items-center justify-between p-2.5 bg-surface-700/40 rounded-xl text-sm">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs">{entry.type === 'chore' ? '🧹' : '🎯'}</span>
                                                                            <div>
                                                                                <p className="text-surface-300 capitalize text-xs font-medium">{entry.type} completion</p>
                                                                                <p className="text-[10px] text-surface-500">{new Date(entry.date).toLocaleDateString()}</p>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-amber-400 font-bold text-sm">+{entry.points_earned} pts</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </MemberCard>
                        );
                    })}
                </div>
            )}

            {/* Claimed / History */}
            {claimedAchievements.length > 0 && (
                <div className="mt-8">
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm font-medium mb-3 min-h-[48px] active:scale-[0.97]">
                        <span className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
                        History ({claimedAchievements.length})
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="space-y-2 overflow-hidden"
                            >
                                {claimedAchievements.map(ach => (
                                    <div key={ach.id} className="flex items-center justify-between px-5 py-3 bg-surface-800/60 rounded-xl opacity-70">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">🏆</span>
                                            <div>
                                                <p className="text-surface-300 font-medium">{ach.prize_name}</p>
                                                <p className="text-[10px] text-surface-500">
                                                    {ach.is_claimed ? `Claimed ${new Date(ach.claimed_at).toLocaleDateString()}` : 'Inactive'}
                                                    {ach.claim_count > 1 && ` · ${ach.claim_count}× total`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-amber-400/60 text-sm font-medium">{ach.target_points} pts</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* PIN Entry Modal */}
            <AnimatePresence>
                {pinEntryMode && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPinEntryMode(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-surface-800 rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-surface-700/50"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-surface-100 mb-2">Enter PIN</h3>
                            <p className="text-xs text-surface-400 mb-4">A parent PIN is required to claim prizes.</p>
                            <input
                                type="password" autoFocus maxLength={4}
                                value={pinInput} onChange={e => setPinInput(e.target.value)}
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] outline-none mb-2"
                                placeholder="••••"
                            />
                            {pinError && <p className="text-xs text-rose-400 mb-4 text-center">{pinError}</p>}
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setPinEntryMode(false)} className="flex-1 min-h-[48px] bg-surface-700 text-surface-300 rounded-xl text-sm font-medium active:scale-[0.97]">Cancel</button>
                                <button onClick={verifyPin} className="flex-1 min-h-[48px] bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold active:scale-[0.97]">Verify</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
