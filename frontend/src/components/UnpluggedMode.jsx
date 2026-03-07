import { useState, useEffect, useCallback } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { post } from '../hooks/useApi';

export default function UnpluggedMode() {
    const { presence, setPresence } = useHousehold();
    const [timeLeft, setTimeLeft] = useState(null);
    const [ending, setEnding] = useState(false);

    // Calculate remaining time
    useEffect(() => {
        if (!presence || presence.status !== 'active') return;

        const updateTimer = () => {
            const start = new Date(presence.start_time).getTime();
            const planned = presence.planned_duration_min * 60 * 1000;
            const end = start + planned;
            const now = Date.now();
            const remaining = Math.max(0, end - now);
            setTimeLeft(remaining);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [presence]);

    const endSession = useCallback(async () => {
        setEnding(true);
        try {
            await post('/presence/end');
            setPresence(null);
        } catch (e) {
            console.error('Failed to end session:', e);
        } finally {
            setEnding(false);
        }
    }, [setPresence]);

    if (!presence || presence.status !== 'active') return null;

    const formatTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const progress = timeLeft !== null
        ? Math.max(0, 1 - timeLeft / (presence.planned_duration_min * 60 * 1000))
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, #0f2027 0%, #1a3a2a 40%, #203a30 70%, #0f1419 100%)',
            }}>
            {/* Ambient particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-forest-400/10 pulse-gentle"
                        style={{
                            width: `${60 + i * 40}px`,
                            height: `${60 + i * 40}px`,
                            left: `${10 + i * 15}%`,
                            top: `${20 + (i % 3) * 25}%`,
                            animationDelay: `${i * 0.8}s`,
                        }}
                    />
                ))}
            </div>

            <div className="relative z-10 text-center px-8">
                {/* Timer circle */}
                <div className="glow-countdown inline-block rounded-full p-8 mb-8">
                    <div className="relative w-56 h-56">
                        <svg className="w-56 h-56 -rotate-90" viewBox="0 0 224 224">
                            <circle cx="112" cy="112" r="100" fill="none" stroke="rgba(109,202,148,0.15)" strokeWidth="8" />
                            <circle
                                cx="112" cy="112" r="100" fill="none"
                                stroke="url(#unpluggedGrad)" strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${progress * 628.3} 628.3`}
                                className="transition-all duration-1000"
                            />
                            <defs>
                                <linearGradient id="unpluggedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#6dca94" />
                                    <stop offset="100%" stopColor="#fbbf24" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-surface-100 tracking-tight font-mono">
                                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                            </span>
                            <span className="text-sm text-forest-400 mt-2">remaining</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <h1 className="text-3xl font-bold text-surface-100 mb-3">
                    Unplugged Mode
                </h1>
                <p className="text-surface-300 text-lg mb-2">
                    Be present. Be together.
                </p>
                {presence.suggested_activity && (
                    <p className="text-forest-300 text-lg mt-4 mb-8 italic">
                        💡 {presence.suggested_activity}
                    </p>
                )}

                {/* End button */}
                <button
                    onClick={endSession}
                    disabled={ending}
                    className="mt-8 px-8 py-3 bg-surface-700/80 hover:bg-surface-600 text-surface-200 rounded-xl
                     text-sm font-medium transition-all border border-surface-600/50 hover:border-surface-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {ending ? 'Ending...' : 'End Session'}
                </button>
            </div>
        </div>
    );
}
