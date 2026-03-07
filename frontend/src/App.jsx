import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HouseholdProvider } from './context/HouseholdContext';
import Dashboard from './components/Dashboard';
import UnpluggedMode from './components/UnpluggedMode';
import ScheduleView from './views/ScheduleView';
import MealsView from './views/MealsView';
import BudgetView from './views/BudgetView';
import ScoringView from './views/ScoringView';

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
        </Routes>
      </HouseholdProvider>
    </BrowserRouter>
  );
}
