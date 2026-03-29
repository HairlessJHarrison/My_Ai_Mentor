import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../context/HouseholdContext';
import { post } from '../hooks/useApi';
import ScheduleCard from './ScheduleCard';
import MealCard from './MealCard';
import BudgetCard from './BudgetCard';
import AchievementCupCard from './AchievementCupCard';
import GoalCard from './GoalCard';
import ChoreCard from './ChoreCard';
import TodoCard from './TodoCard';
import OnboardingWizard from './OnboardingWizard';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableCardWrapper from './SortableCardWrapper';

export default function Dashboard() {
    const navigate = useNavigate();
    const { config, connected, loading, members, refresh, setPresence } = useHousehold();
    const [startingSession, setStartingSession] = useState(false);
    const [showUnplugDialog, setShowUnplugDialog] = useState(false);
    const [duration, setDuration] = useState(30);

    const defaultLayout = ['cup', 'schedule', 'meal', 'budget', 'goal', 'chore', 'todo'];
    const [cardOrder, setCardOrder] = useState(() => {
        const saved = localStorage.getItem('unplugged_dashboard_layout');
        return saved ? JSON.parse(saved) : defaultLayout;
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setCardOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('unplugged_dashboard_layout', JSON.stringify(newOrder));
                return newOrder;
            });
        }
    };

    const componentMap = {
        schedule: <ScheduleCard />,
        meal: <MealCard />,
        budget: <BudgetCard />,
        cup: <AchievementCupCard />,
        goal: <GoalCard />,
        chore: <ChoreCard />,
        todo: <TodoCard />
    };

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });

    const startUnplugged = useCallback(async () => {
        setStartingSession(true);
        try {
            const session = await post('/presence/start', {
                planned_duration_min: duration,
                suggested_activity: 'Go for a family walk 🌿',
            });
            setPresence(session);
            setShowUnplugDialog(false);
        } catch (e) {
            alert(e.message);
        } finally {
            setStartingSession(false);
        }
    }, [duration, setPresence]);

    const needsOnboarding = !loading && members.length === 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-forest-400/30 border-t-forest-400 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-surface-400 text-sm">Loading your household...</p>
                </div>
            </div>
        );
    }

    if (needsOnboarding) {
        return <OnboardingWizard onComplete={refresh} />;
    }

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-surface-100">
                            {config?.household_name || 'Unplugged'}
                        </h1>
                        <p className="text-surface-400 text-sm mt-1">{today}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/calendar')}
                            className="px-4 py-2.5 bg-ocean-600/20 border border-ocean-600/30 text-ocean-300 hover:bg-ocean-600/30 rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                            📆 Calendar
                        </button>
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-forest-400' : 'bg-rose-400'}`} />
                        <span className="text-xs text-surface-500">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {/* Weekly narrative */}
                {config?.weekly_reflection_narrative && (
                    <div className="mt-4 p-4 bg-surface-800/60 rounded-xl border border-surface-700/50">
                        <p className="text-sm text-surface-300 italic leading-relaxed">
                            "{config.weekly_reflection_narrative}"
                        </p>
                    </div>
                )}
            </header>

            {/* Dashboard cards grid */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
                        {cardOrder.map(id => (
                            <SortableCardWrapper key={id} id={id}>
                                {componentMap[id]}
                            </SortableCardWrapper>
                        ))}
                    </SortableContext>
                </div>
            </DndContext>

            {/* Unplugged Button */}
            <div className="flex justify-center">
                <button
                    onClick={() => setShowUnplugDialog(true)}
                    className="group relative px-10 py-5 bg-gradient-to-br from-forest-600 to-forest-800
                     hover:from-forest-500 hover:to-forest-700
                     text-white rounded-2xl text-lg font-semibold tracking-wide
                     transition-all duration-300 shadow-lg shadow-forest-900/50
                     hover:shadow-xl hover:shadow-forest-800/50 hover:scale-[1.02]
                     active:scale-[0.98]"
                >
                    <span className="flex items-center gap-3">
                        <span className="text-2xl group-hover:rotate-12 transition-transform">🌿</span>
                        Go Unplugged
                    </span>
                </button>
            </div>

            {/* Start session dialog */}
            {showUnplugDialog && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowUnplugDialog(false)}>
                    <div className="bg-surface-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-surface-700/50"
                        onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-surface-100 mb-2">Start Unplugged Session</h2>
                        <p className="text-sm text-surface-400 mb-6">Choose how long you'd like to unplug</p>

                        <div className="flex justify-center gap-3 mb-6">
                            {[15, 30, 60, 90].map((mins) => (
                                <button
                                    key={mins}
                                    onClick={() => setDuration(mins)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] active:scale-[0.97] ${duration === mins
                                            ? 'bg-forest-600 text-white'
                                            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                        }`}
                                >
                                    {mins}m
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowUnplugDialog(false)}
                                className="flex-1 py-3 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={startUnplugged}
                                disabled={startingSession}
                                className="flex-1 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-semibold transition-colors min-h-[44px] active:scale-[0.97]
                           disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {startingSession ? 'Starting...' : '🌿 Start'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
