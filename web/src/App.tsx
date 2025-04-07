import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './renderer/components/Layout.js';
import ProblemDetail from './renderer/routes/ProblemDetail.js';
import Settings from './renderer/routes/Settings.js';
import ProblemList from './renderer/routes/ProblemList.js';
import CurrentProblem from './renderer/routes/CurrentProblem.js';
import Dashboard from './renderer/routes/Dashboard.js';
import TextbooksPage from './renderer/routes/TextbooksPage.js';
import UniversitiesPage from './renderer/routes/UniversitiesPage.js';
import SchedulesPage from './renderer/routes/SchedulesPage.js';
import ExamsPage from './renderer/routes/ExamsPage.js';

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
