import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HouseholdProvider } from './context/HouseholdContext';
import { KioskProvider } from './context/KioskContext';
import Dashboard from './components/Dashboard';
import DashboardView from './views/DashboardView';
import UnpluggedMode from './components/UnpluggedMode';
import Screensaver from './components/Screensaver';
import ScheduleView from './views/ScheduleView';
import MealsView from './views/MealsView';
import BudgetView from './views/BudgetView';
import ScoringView from './views/ScoringView';
import GoalsView from './views/GoalsView';
import ChoresView from './views/ChoresView';
import TodoView from './views/TodoView';
import CalendarView from './views/CalendarView';
import ReflectionView from './views/ReflectionView';
import SettingsView from './views/SettingsView';
import AchievementsView from './views/AchievementsView';

export default function App() {
  return (
    <BrowserRouter>
      <KioskProvider>
        <HouseholdProvider>
          <Screensaver />
          <UnpluggedMode />
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/hub" element={<Dashboard />} />
            <Route path="/schedule" element={<ScheduleView />} />
            <Route path="/meals" element={<MealsView />} />
            <Route path="/budget" element={<BudgetView />} />
            <Route path="/scoring" element={<ScoringView />} />
            <Route path="/goals" element={<GoalsView />} />
            <Route path="/chores" element={<ChoresView />} />
            <Route path="/todos" element={<TodoView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/reflection" element={<ReflectionView />} />
            <Route path="/achievements" element={<AchievementsView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </HouseholdProvider>
      </KioskProvider>
    </BrowserRouter>
  );
}
