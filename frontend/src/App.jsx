import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HouseholdProvider } from './context/HouseholdContext';
import Dashboard from './components/Dashboard';
import UnpluggedMode from './components/UnpluggedMode';
import ScheduleView from './views/ScheduleView';
import MealsView from './views/MealsView';
import BudgetView from './views/BudgetView';
import ScoringView from './views/ScoringView';
import GoalsView from './views/GoalsView';
import ChoresView from './views/ChoresView';
import CalendarView from './views/CalendarView';
import ReflectionView from './views/ReflectionView';

export default function App() {
  return (
    <BrowserRouter>
      <HouseholdProvider>
        <UnpluggedMode />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<ScheduleView />} />
          <Route path="/meals" element={<MealsView />} />
          <Route path="/budget" element={<BudgetView />} />
          <Route path="/scoring" element={<ScoringView />} />
          <Route path="/goals" element={<GoalsView />} />
          <Route path="/chores" element={<ChoresView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/reflection" element={<ReflectionView />} />
        </Routes>
      </HouseholdProvider>
    </BrowserRouter>
  );
}
