import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../hooks/useApi';
import { useHousehold } from '../context/HouseholdContext';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';

export default function AchievementsView() {
    const navigate = useNavigate();
    const { config } = useHousehold();
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [logData, setLogData] = useState(null);
    const [logLoading, setLogLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [pinEntryMode, setPinEntryMode] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingClaimId, setPendingClaimId] = useState(null);
    const [form, setForm] = useState({
        prize_name: '', target_points: 100, prize_image_url: '',
    });

    const prefs = config?.preferences || {};
    const actualPin = prefs.parent_pin || null;

    useEffect(() => {
        get('/members').then(m => {
            setMembers(m);
            if (m.length > 0) setSelectedMember(m[0].id);
        }).catch(console.error);
    }, []);

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
        setForm({ prize_name: '', target_points: 100, prize_image_url: '' });
        setShowForm(true);
    };

    const openEditForm = (ach) => {
        setEditingId(ach.id);
        setForm({
            prize_name: ach.prize_name,
            target_points: ach.target_points,
            prize_image_url: ach.prize_image_url || '',
        });
        setShowForm(true);
    };

    const submitForm = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await put(`/achievements/${editingId}`, {
                    prize_name: form.prize_name,
                    target_points: parseInt(form.target_points),
                    prize_image_url: form.prize_image_url || null,
                });
            } else {
                await post('/achievements', {
                    household_id: 'default',
                    member_id: selectedMember,
                    prize_name: form.prize_name,
                    target_points: parseInt(form.target_points),
                    prize_image_url: form.prize_image_url || null,
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
        } catch (err) { alert(err.message); }
    };

    const toggleLog = async (id) => {
        if (expandedId === id) {
            setExpandedId(null);
            setLogData(null);
            return;
        }
        setExpandedId(id);
        setLogLoading(true);
        try {
            const data = await get(`/achievements/${id}/progress`);
            setLogData(data);
        } catch (err) { console.error(err); }
        finally { setLogLoading(false); }
    };

    const activeAchievements = achievements.filter(a => a.is_active && !a.is_claimed);
    const claimedAchievements = achievements.filter(a => a.is_claimed || !a.is_active);
    const selectedMemberData = members.find(m => m.id === selectedMember);

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} className="fixed inset-0 z-50 pointer-events-none" />}

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">🏆 Achievements</h1>
                </div>
                <button onClick={openNewForm}
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                    + New Achievement
                </button>
            </div>

            {/* Member tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {members.map(m => (
                    <button key={m.id} onClick={() => setSelectedMember(m.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] active:scale-[0.97] ${selectedMember === m.id
                            ? 'bg-forest-600 text-white'
                            : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                        }`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                    </button>
                ))}
            </div>

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
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                                className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                            <button type="submit"
                                className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
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
                            <motion.div key={ach.id} layout className="bg-surface-800 rounded-2xl overflow-hidden">
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
                                            <h3 className="text-surface-100 font-semibold text-lg truncate">{ach.prize_name}</h3>
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
                                                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition-colors min-h-[44px] active:scale-[0.97]">
                                                    Claim
                                                </button>
                                            ) : null}
                                            <div className="flex gap-1.5">
                                                <button onClick={() => toggleLog(ach.id)} title="View log"
                                                    className="p-2 text-surface-400 hover:text-surface-200 transition-colors rounded-lg active:scale-[0.97]">
                                                    📋
                                                </button>
                                                <button onClick={() => openEditForm(ach)} title="Edit"
                                                    className="p-2 text-surface-400 hover:text-surface-200 transition-colors rounded-lg active:scale-[0.97]">
                                                    ✏️
                                                </button>
                                                <button onClick={() => deleteAchievement(ach.id)} title="Remove"
                                                    className="p-2 text-surface-400 hover:text-rose-400 transition-colors rounded-lg active:scale-[0.97]">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded log */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-surface-700 overflow-hidden"
                                        >
                                            <div className="p-5 max-h-64 overflow-y-auto">
                                                <h4 className="text-sm font-semibold text-surface-200 mb-3">Point History</h4>
                                                {logLoading ? (
                                                    <p className="text-xs text-surface-500">Loading...</p>
                                                ) : logData?.log?.length === 0 ? (
                                                    <p className="text-xs text-surface-500">No points earned yet. Complete chores and goals!</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {logData?.log?.map((entry, i) => (
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
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Claimed / History */}
            {claimedAchievements.length > 0 && (
                <div className="mt-8">
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm font-medium mb-3 active:scale-[0.97]">
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
                                <button onClick={() => setPinEntryMode(false)} className="flex-1 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm font-medium">Cancel</button>
                                <button onClick={verifyPin} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold">Verify</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
