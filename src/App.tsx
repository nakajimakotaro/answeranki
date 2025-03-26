import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './renderer/components/Layout';
import ProblemDetail from './renderer/routes/ProblemDetail';
import Settings from './renderer/routes/Settings';
import ProblemList from './renderer/routes/ProblemList';
import CurrentProblem from './renderer/routes/CurrentProblem';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
        <Route index element={<ProblemList />} />
        <Route path="problem/:id" element={<ProblemDetail />} />
        <Route path="problems" element={<ProblemList />} />
        <Route path="current" element={<CurrentProblem />} />
        <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
