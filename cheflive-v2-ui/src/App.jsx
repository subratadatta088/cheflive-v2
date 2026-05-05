import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppHeader } from './components/AppHeader.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { HomePage } from './pages/home/HomePage.jsx'
import { InventoryCategoriesPage } from './pages/inventory/InventoryCategoriesPage.jsx'
import { InventoryIngredientsPage } from './pages/inventory/ingredient/InventoryIngredientsPage.jsx'
import { InventoryIngredientCreatePage } from './pages/inventory/ingredient/InventoryIngredientCreatePage.jsx'
import { InventoryPreparationsPage } from './pages/inventory/preparation/InventoryPreparationsPage.jsx'
import { InventoryPreparationCreatePage } from './pages/inventory/preparation/InventoryPreparationCreatePage.jsx'
import { PurchasesCreatePage } from './pages/purchases/PurchasesCreatePage.jsx'
import { PurchasesHistoryPage } from './pages/purchases/PurchasesHistoryPage.jsx'
import { TransfersCreatePage } from './pages/transfers/TransfersCreatePage.jsx'
import { TransfersHistoryPage } from './pages/transfers/TransfersHistoryPage.jsx'
import { UtilizationsCreatePage } from './pages/utilizations/UtilizationsCreatePage.jsx'
import { UtilizationsHistoryPage } from './pages/utilizations/UtilizationsHistoryPage.jsx'
import { ReportPurchasesPage } from './pages/report/ReportPurchasesPage.jsx'
import { ReportUsagePage } from './pages/report/ReportUsagePage.jsx'
import { LoginPage } from './pages/auth/LoginPage.jsx'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.jsx'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'

const ROUTE_META = /** @type {const} */ ({
  '/login': { title: 'Login', crumbs: ['Login'] },
  '/forgot-password': { title: 'Forgot password', crumbs: ['Forgot password'] },
  '/reset-password': { title: 'Reset password', crumbs: ['Reset password'] },
  '/home': { title: 'Home', crumbs: ['Home'] },
  '/inventory/categories': { title: 'Inventory • Categories', crumbs: ['Inventory', 'Categories'] },
  '/inventory/ingredients': { title: 'Inventory • Ingredients', crumbs: ['Inventory', 'Ingredients'] },
  '/inventory/ingredients/create': { title: 'Inventory • Ingredients • Create', crumbs: ['Inventory', 'Ingredients', 'Create'] },
  '/inventory/preparations': { title: 'Inventory • Preparations', crumbs: ['Inventory', 'Preparations'] },
  '/inventory/preparations/create': { title: 'Inventory • Preparations • Create', crumbs: ['Inventory', 'Preparations', 'Create'] },
  '/purchases/create': { title: 'Purchases • Create', crumbs: ['Purchases', 'Create'] },
  '/purchases/history': { title: 'Purchases • History', crumbs: ['Purchases', 'History'] },
  '/transfers/create': { title: 'Transfers • Create', crumbs: ['Transfers', 'Create'] },
  '/transfers/history': { title: 'Transfers • History', crumbs: ['Transfers', 'History'] },
  '/utilizations/create': { title: 'Utilizations • Create', crumbs: ['Utilizations', 'Create'] },
  '/utilizations/history': { title: 'Utilizations • History', crumbs: ['Utilizations', 'History'] },
  '/report/purchases': { title: 'Report • Purchase report', crumbs: ['Report', 'Purchase report'] },
  '/report/usage': { title: 'Report • Usage report', crumbs: ['Report', 'Usage report'] },
})

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  const meta = ROUTE_META[location.pathname] ?? { title: 'Cheflive', crumbs: ['Cheflive'] }
  const { username, logout } = useAuth()
  const isAuthRoute =
    location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname === '/reset-password'

  useEffect(() => {
    const api = window.cheflive
    if (!api?.onNavigate) return

    const unsubscribe = api.onNavigate((payload) => {
      if (payload?.path) navigate(payload.path)
    })
    return () => unsubscribe?.()
  }, [navigate])

  return (
    <>
      {!isAuthRoute ? (
        <AppHeader
          username={username || 'User'}
          onLogout={() => {
            logout()
            navigate('/login')
          }}
        />
      ) : null}
      <main className={isAuthRoute ? 'min-h-screen px-4 py-8' : 'mx-auto max-w-8xl px-4 py-4'}>
        <div>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory/categories"
              element={
                <RequireAuth>
                  <InventoryCategoriesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory/ingredients"
              element={
                <RequireAuth>
                  <InventoryIngredientsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory/ingredients/create"
              element={
                <RequireAuth>
                  <InventoryIngredientCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory/preparations"
              element={
                <RequireAuth>
                  <InventoryPreparationsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory/preparations/create"
              element={
                <RequireAuth>
                  <InventoryPreparationCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/purchases/create"
              element={
                <RequireAuth>
                  <PurchasesCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/purchases/history"
              element={
                <RequireAuth>
                  <PurchasesHistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/transfers/create"
              element={
                <RequireAuth>
                  <TransfersCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/transfers/history"
              element={
                <RequireAuth>
                  <TransfersHistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/utilizations/create"
              element={
                <RequireAuth>
                  <UtilizationsCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/utilizations/history"
              element={
                <RequireAuth>
                  <UtilizationsHistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/report/purchases"
              element={
                <RequireAuth>
                  <ReportPurchasesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/report/usage"
              element={
                <RequireAuth>
                  <ReportUsagePage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </HashRouter>
  )
}
