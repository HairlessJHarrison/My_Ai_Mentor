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
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const [sched, meal, budg, score, pres, conf, mem, gls, chs] = await Promise.all([
                get('/schedules/today'),
                get('/meals/plan?week=current'),
                get('/budgets/summary?month=current'),
                get('/scoring/today'),
                get('/presence/current'),
                get('/config/household'),
                get('/members'),
                get('/goals'),
                get('/chores/status'),
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
        } catch (e) {
            console.error('Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

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
                break;
            case 'chore_completed':
            case 'chore_verified':
                get('/chores/status').then(setChores).catch(() => { });
                break;
            case 'calendar_synced':
                refresh();
                break;
        }
    }, [refresh]);

    const { connected } = useWebSocket(handleWsEvent);

    return (
        <HouseholdContext.Provider value={{
            schedule, meals, budget, scoring, presence, config,
            members, goals, chores,
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
