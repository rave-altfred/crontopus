import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import Register from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Endpoints } from './pages/Endpoints';
import { AgentDownload } from './pages/AgentDownload';
import { Runs } from './pages/Runs';
import { RunsByJob } from './pages/RunsByJob';
import { RunsByEndpoint } from './pages/RunsByEndpoint';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { JobNew } from './pages/JobNew';
import { JobEdit } from './pages/JobEdit';
import { AssignJobsToEndpoint } from './pages/AssignJobsToEndpoint';
import { AssignEndpointsToJob } from './pages/AssignEndpointsToJob';
import { Groups } from './pages/Groups';
import { APITokens } from './pages/APITokens';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="agents" element={<AgentDownload />} />
            <Route path="endpoints" element={<Endpoints />} />
            <Route path="endpoints/:endpointId/assign-jobs" element={<AssignJobsToEndpoint />} />
            <Route path="runs" element={<Runs />} />
            <Route path="runs/by-job" element={<RunsByJob />} />
            <Route path="runs/by-endpoint" element={<RunsByEndpoint />} />
            <Route path="groups" element={<Groups />} />
            <Route path="api-tokens" element={<APITokens />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/new" element={<JobNew />} />
            <Route path="jobs/:namespace/:jobName/edit" element={<JobEdit />} />
            <Route path="jobs/:namespace/:jobName/assign-endpoints" element={<AssignEndpointsToJob />} />
            <Route path="jobs/*" element={<JobDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
