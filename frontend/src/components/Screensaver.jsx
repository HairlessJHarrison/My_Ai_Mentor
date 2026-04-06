import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useKiosk } from '../context/KioskContext';
import { get } from '../hooks/useApi';

// How long each photo is displayed (ms)
const SLIDE_DURATION = 8000;

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

function ClockDisplay({ familyName, compact = false }) {
    const now = useClock();

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

    if (compact) {
        return (
            <div className="text-right">
                <p className="text-white/90 text-2xl font-light tabular-nums drop-shadow-lg">{time}</p>
                <p className="text-white/60 text-sm drop-shadow">{date}</p>
            </div>
        );
    }

    return (
        <div className="text-center select-none">
            <p className="text-white/30 text-xl font-light tracking-widest uppercase mb-4">
                {familyName}
            </p>
            <p className="text-white text-8xl font-extralight tabular-nums drop-shadow-2xl mb-4">
                {time}
            </p>
            <p className="text-white/60 text-2xl font-light drop-shadow">{date}</p>
        </div>
    );
}

// ── Triple-tap top-right corner to exit kiosk ─────────────────────────────────
function useExitGesture(onExit) {
    const tapsRef = useRef([]);

    const handleTap = useCallback((e) => {
        const { clientX, clientY } = e.changedTouches ? e.changedTouches[0] : e;
        const inCorner = clientX > window.innerWidth - 80 && clientY < 80;
        if (!inCorner) return;

        const now = Date.now();
        tapsRef.current = tapsRef.current.filter(t => now - t < 2000);
        tapsRef.current.push(now);

        if (tapsRef.current.length >= 3) {
            tapsRef.current = [];
            onExit();
        }
    }, [onExit]);

    useEffect(() => {
        window.addEventListener('touchend', handleTap);
        window.addEventListener('click', handleTap);
        return () => {
            window.removeEventListener('touchend', handleTap);
            window.removeEventListener('click', handleTap);
        };
    }, [handleTap]);
}

export default function Screensaver() {
    const { settings, screensaverActive, resetIdleTimer, exitFullscreen, saveSettings } = useKiosk();
    const [photos, setPhotos] = useState([]);
    const [photoIndex, setPhotoIndex] = useState(0);
    const slideTimerRef = useRef(null);

    // Load photos when screensaver becomes active
    useEffect(() => {
        if (!screensaverActive) return;
        get('/kiosk/photos').then(setPhotos).catch(() => setPhotos([]));
    }, [screensaverActive]);

    // Cycle through photos
    useEffect(() => {
        if (!screensaverActive || photos.length < 2) return;
        slideTimerRef.current = setInterval(() => {
            setPhotoIndex(i => (i + 1) % photos.length);
        }, SLIDE_DURATION);
        return () => clearInterval(slideTimerRef.current);
    }, [screensaverActive, photos]);

    // Reset index when screensaver re-opens
    useEffect(() => {
        if (screensaverActive) setPhotoIndex(0);
    }, [screensaverActive]);

    // Exit gesture: triple-tap top-right corner exits kiosk entirely
    const handleExitKiosk = useCallback(async () => {
        exitFullscreen();
        await saveSettings({ enabled: false }).catch(() => { });
    }, [exitFullscreen, saveSettings]);

    useExitGesture(handleExitKiosk);

    const currentPhoto = photos[photoIndex];

    return (
        <AnimatePresence>
            {screensaverActive && (
                <motion.div
                    key="screensaver"
                    className="fixed inset-0 z-[60] overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2 }}
                    // Any interaction wakes from screensaver
                    onMouseMove={resetIdleTimer}
                    onTouchStart={resetIdleTimer}
                    onMouseDown={resetIdleTimer}
                    onKeyDown={resetIdleTimer}
                    tabIndex={-1}
                >
                    {/* Background — photo or solid dark */}
                    <AnimatePresence mode="sync">
                        {currentPhoto ? (
                            <motion.div
                                key={currentPhoto.filename}
                                className="absolute inset-0"
                                initial={{ opacity: 0, scale: 1.04 }}
                                animate={{ opacity: 1, scale: 1.0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 2, ease: 'easeInOut' }}
                                style={{
                                    backgroundImage: `url(${currentPhoto.url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                        ) : (
                            <motion.div
                                key="dark-bg"
                                className="absolute inset-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                style={{
                                    background: 'linear-gradient(135deg, #0f1419 0%, #1a2028 50%, #0f2027 100%)',
                                }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Dark overlay gradient — always present for readability */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: currentPhoto
                                ? 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.55) 100%)'
                                : 'transparent',
                        }}
                    />

                    {/* Main content — clock (only shown when no photos) */}
                    {!currentPhoto && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <ClockDisplay familyName={settings.family_name} />
                        </div>
                    )}

                    {/* Clock overlay — always shown in bottom-right */}
                    <div className="absolute bottom-8 right-8 pointer-events-none">
                        <ClockDisplay familyName={settings.family_name} compact />
                    </div>

                    {/* Photo dot indicators */}
                    {photos.length > 1 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                            {photos.map((_, i) => (
                                <div
                                    key={i}
                                    className={`rounded-full transition-all duration-500 ${
                                        i === photoIndex
                                            ? 'w-4 h-1.5 bg-white/80'
                                            : 'w-1.5 h-1.5 bg-white/30'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Hidden tap zone visual hint — top-right corner */}
                    <div
                        className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
                        aria-hidden="true"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
