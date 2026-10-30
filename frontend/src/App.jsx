import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const Students = lazy(() => import('./pages/Students'))
const Menus = lazy(() => import('./pages/Menus'))
const FoodItems = lazy(() => import('./pages/FoodItems'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Payments = lazy(() => import('./pages/Payments'))
const Complaints = lazy(() => import('./pages/Complaints'))
const Wastage = lazy(() => import('./pages/Wastage'))
const Reports = lazy(() => import('./pages/Reports'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

// Pages a role cannot use show a friendly message (the API would return 403 anyway).
function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user.role)) return <NotFound forbidden />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<Loading label="Loading page…" />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={user?.role === 'student' ? <StudentDashboard /> : <Dashboard />} />
          <Route path="students" element={<RoleRoute roles={['admin', 'staff']}><Students /></RoleRoute>} />
          <Route path="menus" element={<Menus />} />
          <Route path="food-items" element={<FoodItems />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="payments" element={<RoleRoute roles={['admin', 'student']}><Payments /></RoleRoute>} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="wastage" element={<RoleRoute roles={['admin', 'staff']}><Wastage /></RoleRoute>} />
          <Route path="reports" element={<RoleRoute roles={['admin', 'staff']}><Reports /></RoleRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
