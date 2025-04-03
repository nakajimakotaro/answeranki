import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './renderer/components/Layout';
import ProblemDetail from './renderer/routes/ProblemDetail';
import Settings from './renderer/routes/Settings';
import ProblemList from './renderer/routes/ProblemList';
import CurrentProblem from './renderer/routes/CurrentProblem';
import Dashboard from './renderer/routes/Dashboard';
import TextbooksPage from './renderer/routes/TextbooksPage';
import UniversitiesPage from './renderer/routes/UniversitiesPage';
import SchedulesPage from './renderer/routes/SchedulesPage';
import ExamsPage from './renderer/routes/ExamsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="problem/:id" element={<ProblemDetail />} />
        <Route path="problems" element={<ProblemList />} />
        <Route path="current" element={<CurrentProblem />} />
        <Route path="textbooks" element={<TextbooksPage />} />
        <Route path="universities" element={<UniversitiesPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
