import { useEffect, useMemo } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppHeader } from './components/AppHeader.jsx'
import { HomePage } from './pages/home/HomePage.jsx'
import { InventoryIngredientsPage } from './pages/inventory/InventoryIngredientsPage.jsx'
import { InventoryIngredientCreatePage } from './pages/inventory/InventoryIngredientCreatePage.jsx'
import { InventoryPreparationsPage } from './pages/inventory/InventoryPreparationsPage.jsx'
import { PurchasesCreatePage } from './pages/purchases/PurchasesCreatePage.jsx'
import { PurchasesHistoryPage } from './pages/purchases/PurchasesHistoryPage.jsx'
import { TransfersCreatePage } from './pages/transfers/TransfersCreatePage.jsx'
import { TransfersHistoryPage } from './pages/transfers/TransfersHistoryPage.jsx'
import { UtilizationsCreatePage } from './pages/utilizations/UtilizationsCreatePage.jsx'
import { UtilizationsHistoryPage } from './pages/utilizations/UtilizationsHistoryPage.jsx'
import { ReportPurchasesPage } from './pages/report/ReportPurchasesPage.jsx'
import { ReportUsagePage } from './pages/report/ReportUsagePage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'

const ROUTE_META = /** @type {const} */ ({
  '/home': { title: 'Home', crumbs: ['Home'] },
  '/inventory/ingredients': { title: 'Inventory • Ingredients', crumbs: ['Inventory', 'Ingredients'] },
  '/inventory/ingredients/create': { title: 'Inventory • Ingredients • Create', crumbs: ['Inventory', 'Ingredients', 'Create'] },
  '/inventory/preparations': { title: 'Inventory • Preparations', crumbs: ['Inventory', 'Preparations'] },
  '/purchases/create': { title: 'Purchases • Create', crumbs: ['Purchases', 'Create'] },
  '/purchases/history': { title: 'Purchases • History', crumbs: ['Purchases', 'History'] },
  '/transfers/create': { title: 'Transfers • Create', crumbs: ['Transfers', 'Create'] },
  '/transfers/history': { title: 'Transfers • History', crumbs: ['Transfers', 'History'] },
  '/utilizations/create': { title: 'Utilizations • Create', crumbs: ['Utilizations', 'Create'] },
  '/utilizations/history': { title: 'Utilizations • History', crumbs: ['Utilizations', 'History'] },
  '/report/purchases': { title: 'Report • Purchase report', crumbs: ['Report', 'Purchase report'] },
  '/report/usage': { title: 'Report • Usage report', crumbs: ['Report', 'Usage report'] },
})

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  const meta = ROUTE_META[location.pathname] ?? { title: 'Cheflive', crumbs: ['Cheflive'] }
  const userName = useMemo(() => localStorage.getItem('cheflive:userName') || 'User', [])

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
      <AppHeader
        userName={userName}
        onLogout={() => {
          localStorage.removeItem('cheflive:userName')
          navigate('/home')
        }}
      />
      <main className="mx-auto max-w-8xl px-4 py-4">
        <div>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/inventory/ingredients" element={<InventoryIngredientsPage />} />
            <Route path="/inventory/ingredients/create" element={<InventoryIngredientCreatePage />} />
            <Route path="/inventory/preparations" element={<InventoryPreparationsPage />} />
            <Route path="/purchases/create" element={<PurchasesCreatePage />} />
            <Route path="/purchases/history" element={<PurchasesHistoryPage />} />
            <Route path="/transfers/create" element={<TransfersCreatePage />} />
            <Route path="/transfers/history" element={<TransfersHistoryPage />} />
            <Route path="/utilizations/create" element={<UtilizationsCreatePage />} />
            <Route path="/utilizations/history" element={<UtilizationsHistoryPage />} />
            <Route path="/report/purchases" element={<ReportPurchasesPage />} />
            <Route path="/report/usage" element={<ReportUsagePage />} />
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
      <AppShell />
    </HashRouter>
  )
}
