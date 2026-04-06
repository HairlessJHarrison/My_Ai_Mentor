import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { get, put } from '../hooks/useApi';

const KioskContext = createContext(null);

const DEFAULT_SETTINGS = {
    enabled: false,
    auto_fullscreen: false,
    idle_timeout_seconds: 120,
    family_name: 'Our Family',
};

// How long after last mouse movement to hide the cursor (ms)
const CURSOR_HIDE_DELAY = 4000;

export function KioskProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [screensaverActive, setScreensaverActive] = useState(false);
    const [cursorHidden, setCursorHidden] = useState(false);

    // Refs to avoid stale closures in event handlers
    const settingsRef = useRef(settings);
    const idleTimerRef = useRef(null);
    const cursorTimerRef = useRef(null);
    const wakeLockRef = useRef(null);

    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Load settings on mount
    useEffect(() => {
        get('/kiosk/settings').then(setSettings).catch(() => { });
    }, []);

    // Fullscreen change listener
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // Wake Lock — request when kiosk is enabled, release when disabled
    useEffect(() => {
        if (!settings.enabled || !('wakeLock' in navigator)) return;
        let released = false;
        navigator.wakeLock.request('screen').then(lock => {
            wakeLockRef.current = lock;
            // Re-request on visibility change (browser drops lock when tab is hidden)
            const onVisible = () => {
                if (document.visibilityState === 'visible' && !released) {
                    navigator.wakeLock.request('screen')
                        .then(l => { wakeLockRef.current = l; })
                        .catch(() => { });
                }
            };
            document.addEventListener('visibilitychange', onVisible);
            lock._cleanupVisibility = onVisible;
        }).catch(() => { });

        return () => {
            released = true;
            if (wakeLockRef.current) {
                if (wakeLockRef.current._cleanupVisibility) {
                    document.removeEventListener('visibilitychange', wakeLockRef.current._cleanupVisibility);
                }
                wakeLockRef.current.release().catch(() => { });
                wakeLockRef.current = null;
            }
        };
    }, [settings.enabled]);

    // Auto-fullscreen on startup when setting is enabled
    useEffect(() => {
        if (settings.enabled && settings.auto_fullscreen && !isFullscreen) {
            document.documentElement.requestFullscreen?.().catch(() => { });
        }
    // Only fire on initial settings load, not on every fullscreen change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.enabled, settings.auto_fullscreen]);

    // ── Idle / screensaver timer ───────────────────────────────────────────────

    const resetIdleTimer = useCallback(() => {
        setScreensaverActive(false);
        clearTimeout(idleTimerRef.current);
        const { enabled, idle_timeout_seconds } = settingsRef.current;
        if (enabled && idle_timeout_seconds > 0) {
            idleTimerRef.current = setTimeout(
                () => setScreensaverActive(true),
                idle_timeout_seconds * 1000,
            );
        }
    }, []);

    useEffect(() => {
        if (!settings.enabled) {
            clearTimeout(idleTimerRef.current);
            setScreensaverActive(false);
            return;
        }
        const events = ['mousedown', 'mousemove', 'touchstart', 'keydown', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
        resetIdleTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, resetIdleTimer));
            clearTimeout(idleTimerRef.current);
        };
    }, [settings.enabled, resetIdleTimer]);

    // ── Cursor hiding ──────────────────────────────────────────────────────────

    const resetCursorTimer = useCallback(() => {
        setCursorHidden(false);
        clearTimeout(cursorTimerRef.current);
        if (settingsRef.current.enabled) {
            cursorTimerRef.current = setTimeout(() => setCursorHidden(true), CURSOR_HIDE_DELAY);
        }
    }, []);

    useEffect(() => {
        if (!settings.enabled) {
            clearTimeout(cursorTimerRef.current);
            setCursorHidden(false);
            return;
        }
        window.addEventListener('mousemove', resetCursorTimer, { passive: true });
        resetCursorTimer();
        return () => {
            window.removeEventListener('mousemove', resetCursorTimer);
            clearTimeout(cursorTimerRef.current);
        };
    }, [settings.enabled, resetCursorTimer]);

    // ── Public API ─────────────────────────────────────────────────────────────

    const enterFullscreen = useCallback(() => {
        document.documentElement.requestFullscreen?.().catch(() => { });
    }, []);

    const exitFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => { });
        }
    }, []);

    const saveSettings = useCallback(async (patch) => {
        const updated = await put('/kiosk/settings', patch);
        setSettings(updated);
        return updated;
    }, []);

    return (
        <KioskContext.Provider value={{
            settings, setSettings, saveSettings,
            isFullscreen, screensaverActive, cursorHidden,
            enterFullscreen, exitFullscreen, resetIdleTimer,
        }}>
            <div style={{ cursor: cursorHidden && settings.enabled ? 'none' : undefined }}>
                {children}
            </div>
        </KioskContext.Provider>
    );
}

export function useKiosk() {
    const ctx = useContext(KioskContext);
    if (!ctx) throw new Error('useKiosk must be used within KioskProvider');
    return ctx;
}
