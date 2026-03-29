import { useState, useEffect, useCallback } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { useNavigate } from 'react-router-dom';
import { get, put } from '../hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';

export default function AchievementCupCard() {
    const { config, refresh } = useHousehold();
    const navigate = useNavigate();
    
    const [cupData, setCupData] = useState({ activities: [], total_points: 0 });
    const [showSettings, setShowSettings] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [pinEntryMode, setPinEntryMode] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // 'settings' or 'reset'
    const [showConfetti, setShowConfetti] = useState(false);
    
    // Form state for settings
    const [form, setForm] = useState({
        prize_name: '',
        prize_goal_points: 1000,
        prize_image_url: '',
        parent_pin: ''
    });

    const prefs = config?.preferences || {};
    const goalName = prefs.prize_name || 'Set a Prize Goal!';
    const goalPoints = parseInt(prefs.prize_goal_points) || 1000;
    const goalImage = prefs.prize_image_url || null;
    const lastReset = prefs.last_reset_date || null;
    const actualPin = prefs.parent_pin || null;

    useEffect(() => {
        let url = '/scoring/cup';
        if (lastReset) {
            url += `?since=${lastReset}`;
        }
        get(url).then(data => {
            setCupData(data);
            if (data.total_points >= goalPoints && goalPoints > 0 && data.total_points > 0) {
                // If they hit the goal, maybe we show confetti once (we can do it simply here)
                // For a real app, we might track 'confetti_shown' in localStorage
            }
        }).catch(() => {});
    }, [lastReset, goalPoints]);

    // Handle Auth for protected actions
    const requirePin = (action) => {
        if (!actualPin) {
            executeAction(action);
        } else {
            setPendingAction(action);
            setPinInput('');
            setPinError('');
            setPinEntryMode(true);
        }
    };

    const verifyPin = () => {
        if (pinInput === actualPin) {
            setPinEntryMode(false);
            executeAction(pendingAction);
        } else {
            setPinError('Incorrect PIN');
        }
    };

    const executeAction = (action) => {
        if (action === 'settings') {
            setForm({
                prize_name: prefs.prize_name || '',
                prize_goal_points: prefs.prize_goal_points || 1000,
                prize_image_url: prefs.prize_image_url || '',
                parent_pin: prefs.parent_pin || ''
            });
            setShowSettings(true);
        } else if (action === 'reset') {
            handleReset();
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await put('/config/household', {
                preferences: {
                    ...prefs,
                    prize_name: form.prize_name,
                    prize_goal_points: parseInt(form.prize_goal_points),
                    prize_image_url: form.prize_image_url,
                    parent_pin: form.parent_pin
                }
            });
            setShowSettings(false);
            refresh();
        } catch (err) {
            alert('Failed to save settings: ' + err.message);
        }
    };

    const handleReset = async () => {
        try {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000); // 5 sec confetti
            
            await put('/config/household', {
                preferences: {
                    ...prefs,
                    last_reset_date: new Date().toISOString()
                }
            });
            setCupData({ activities: [], total_points: 0 });
            refresh();
        } catch (err) {
            alert('Failed to reset cup: ' + err.message);
        }
    };

    const currentPoints = cupData.total_points;
    const percent = Math.min((currentPoints / goalPoints) * 100, 100);

    return (
        <div className="card-animated bg-surface-800 rounded-2xl p-5 relative overflow-hidden h-full flex flex-col" style={{ animationDelay: '0.4s' }}>
            {showConfetti && <Confetti width={500} height={500} recycle={false} numberOfPieces={200} className="absolute inset-0 z-50 pointer-events-none" />}
            
            <div className="flex items-center justify-between mb-4 z-10 relative">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">🏆</span> Achievement Cup
                </h3>
                <div className="flex gap-2 text-surface-400">
                    <button onClick={(e) => { e.stopPropagation(); setShowLog(true); }} className="hover:text-surface-200 transition-colors cursor-pointer" title="View Points Log">
                        📋
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); requirePin('settings'); }} className="hover:text-surface-200 transition-colors cursor-pointer" title="Goal Settings">
                        ⚙️
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <div className="relative w-32 h-32 mb-4 bg-surface-700/50 rounded-full border-4 border-surface-700 overflow-hidden flex items-center justify-center shrink-0">
                    {/* Animated Fill Background */}
                    <motion.div 
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-amber-600 to-amber-400 opacity-30"
                        initial={{ height: 0 }}
                        animate={{ height: `${percent}%` }}
                        transition={{ duration: 1.5, type: "spring", bounce: 0.3 }}
                    />
                    
                    {/* Image or emoji */}
                    {goalImage ? (
                        <img src={goalImage} alt="Prize" className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay" />
                    ) : (
                        <span className="text-5xl opacity-50 relative z-10">🎁</span>
                    )}

                    {/* Progress Circle overlay */}
                     <svg className="absolute inset-0 w-full h-full -rotate-90 z-20 pointer-events-none" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="transparent" strokeWidth="8" />
                        <motion.circle
                            cx="50" cy="50" r="46" fill="none"
                            stroke="var(--color-amber-400)" strokeWidth="8"
                            strokeLinecap="round"
                            initial={{ strokeDasharray: "0 289" }}
                            animate={{ strokeDasharray: `${(percent / 100) * 289} 289` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                    </svg>
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-30 drop-shadow-md">
                        <span className="text-2xl font-bold text-white leading-none">{currentPoints}</span>
                        <span className="text-[10px] text-white/80 font-medium">/ {goalPoints}</span>
                    </div>
                </div>
                
                <h4 className="text-surface-200 font-medium text-center">{goalName}</h4>
                <p className="text-xs text-surface-400 mt-1">{percent === 100 ? 'Goal reached!' : `${goalPoints - currentPoints} pts to go!`}</p>
                
                {percent === 100 && (
                     <button onClick={(e) => { e.stopPropagation(); requirePin('reset'); }} className="mt-3 px-4 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition-colors">
                        Claim & Reset
                    </button>
                )}
            </div>

            {/* PIN Entry Modal */}
            <AnimatePresence>
                {pinEntryMode && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPinEntryMode(false)}>
                         <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-surface-800 rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-surface-700/50 relative overflow-hidden" 
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-surface-100 mb-2">Enter PIN</h3>
                            <p className="text-xs text-surface-400 mb-4">A parent PIN is required for this action.</p>
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

            {/* Settings Modal */}
             <AnimatePresence>
                {showSettings && (
                     <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                         <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                            className="bg-surface-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-surface-700/50 max-h-[90vh] overflow-y-auto" 
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-surface-100 mb-4">🏆 Cup Settings</h3>
                            <form onSubmit={handleSaveSettings} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1">Prize Name / Description</label>
                                    <input required type="text" value={form.prize_name} onChange={e => setForm({...form, prize_name: e.target.value})} className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-2 text-sm outline-none" placeholder="e.g. Family Trip to the Zoo" />
                                </div>
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1">Points Goal</label>
                                    <input required type="number" min="10" value={form.prize_goal_points} onChange={e => setForm({...form, prize_goal_points: e.target.value})} className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-2 text-sm outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1">Prize Image URL (Optional)</label>
                                    <input type="url" value={form.prize_image_url} onChange={e => setForm({...form, prize_image_url: e.target.value})} className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-2 text-sm outline-none" placeholder="https://..." />
                                </div>
                                <div className="pt-2 border-t border-surface-700">
                                    <label className="block text-xs text-amber-400/80 mb-1">Parent PIN (Optional)</label>
                                    <p className="text-[10px] text-surface-400 mb-2">Leave blank for no PIN. Protects settings and resetting the cup.</p>
                                    <input type="password" maxLength={4} value={form.parent_pin} onChange={e => setForm({...form, parent_pin: e.target.value})} className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-2 text-sm tracking-[0.2em] outline-none" placeholder="4 digit PIN" />
                                </div>
                                
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowSettings(false)} className="flex-1 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm font-medium">Cancel</button>
                                    <button type="submit" className="flex-1 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-semibold">Save Goals</button>
                                </div>
                            </form>
                            
                            <div className="mt-6 pt-4 border-t border-surface-700">
                                <button type="button" onClick={() => { setShowSettings(false); requirePin('reset'); }} className="w-full py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-sm font-semibold">Reset Points to 0</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Activities Log Modal */}
             <AnimatePresence>
                {showLog && (
                     <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLog(false)}>
                         <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                            className="bg-surface-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-surface-700/50 max-h-[80vh] flex flex-col" 
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-surface-100 mb-1">📋 Point History</h3>
                            <p className="text-xs text-surface-400 mb-4">Activities contributing to the current cup.</p>
                            
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {cupData.activities.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-8">No points earned yet!</p>
                                ) : (
                                    cupData.activities.map((act) => (
                                        <div key={act.id} className="flex items-center justify-between p-3 bg-surface-700/40 rounded-xl text-sm">
                                            <div>
                                                <p className="text-surface-200 capitalize font-medium">{act.activity_type.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] text-surface-500">{new Date(act.date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-amber-400 font-bold">+{act.points_earned} pts</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <button onClick={() => setShowLog(false)} className="mt-4 w-full py-3 bg-surface-700 hover:bg-surface-600 text-surface-100 rounded-xl text-sm font-medium">Close Log</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
