import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { get } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
    const [schedule, setSchedule] = useState({ events: [], free_blocks: [] });
    const [meals, setMeals] = useState({ meals: [], total_cost: 0, avg_health_score: 0 });
    const [budget, setBudget] = useState({ categories: [], total_limit: 0, total_spent: 0 });
    const [scoring, setScoring] = useState({ activities: [], total_points: 0 });
    const [presence, setPresence] = useState(null);
    const [config, setConfig] = useState(null);
    const [members, setMembers] = useState([]);
    const [goals, setGoals] = useState([]);
    const [chores, setChores] = useState({ members: [] });
    const [todos, setTodos] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const [sched, meal, budg, score, pres, conf, mem, gls, chs, tds, achs, notifs] = await Promise.all([
                get('/schedules/today'),
                get('/meals/plan?week=current'),
                get('/budgets/summary?month=current'),
                get('/scoring/today'),
                get('/presence/current'),
                get('/config/household'),
                get('/members'),
                get('/goals'),
                get('/chores/status'),
                get('/todos'),
                get('/achievements'),
                get('/notifications?limit=50'),
            ]);
            setSchedule(sched);
            setMeals(meal);
            setBudget(budg);
            setScoring(score);
            setPresence(pres);
            setConfig(conf);
            setMembers(mem);
            setGoals(gls);
            setChores(chs);
            setTodos(tds);
            setAchievements(achs);
            setNotifications(notifs);
        } catch (e) {
            console.error('Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Notification helpers exposed to components (avoid redundant API round-trips)
    const markNotificationRead = useCallback((id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const handleWsEvent = useCallback((event, data) => {
        switch (event) {
            case 'schedule_updated':
                refresh();
                break;
            case 'meal_plan_changed':
                refresh();
                break;
            case 'transaction_logged':
                get('/budgets/summary?month=current').then(setBudget).catch(() => { });
                break;
            case 'activity_scored':
                get('/scoring/today').then(setScoring).catch(() => { });
                break;
            case 'presence_started':
                setPresence(data);
                break;
            case 'presence_ended':
                setPresence(null);
                get('/scoring/today').then(setScoring).catch(() => { });
                break;
            case 'config_updated':
                setConfig(data);
                break;
            case 'goal_completed':
                get('/goals').then(setGoals).catch(() => { });
                get('/chores/status').then(setChores).catch(() => { });
                get('/achievements').then(setAchievements).catch(() => { });
                break;
            case 'chore_completed':
            case 'chore_verified':
                get('/chores/status').then(setChores).catch(() => { });
                get('/achievements').then(setAchievements).catch(() => { });
                break;
            case 'achievement_claimed':
                get('/achievements').then(setAchievements).catch(() => { });
                break;
            case 'calendar_synced':
                refresh();
                break;
            case 'todo_updated':
                get('/todos').then(setTodos).catch(() => { });
                break;
            case 'notification_created':
                // Prepend the new notification so it appears at the top
                setNotifications(prev => [data, ...prev]);
                break;
        }
    }, [refresh]);

    const { connected } = useWebSocket(handleWsEvent);

    return (
        <HouseholdContext.Provider value={{
            schedule, meals, budget, scoring, presence, config,
            members, goals, chores, todos, achievements,
            notifications, markNotificationRead, markAllNotificationsRead, removeNotification,
            loading, connected, refresh, setPresence,
        }}>
            {children}
        </HouseholdContext.Provider>
    );
}

export function useHousehold() {
    const ctx = useContext(HouseholdContext);
    if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
    return ctx;
}
