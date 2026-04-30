import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function StatCard({ label, value, sublabel }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sublabel ? <div className="mt-1 text-sm text-slate-600">{sublabel}</div> : null}
    </div>
  )
}

function TrendChart({ points, color, ariaLabel }) {
  const data = points.map((value, idx) => ({ idx: idx + 1, value }))

  return (
    <div className="h-12 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} role="img" aria-label={ariaLabel}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function StockBarChart({ data }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} barCategoryGap={28} barSize={18}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.03)' }}
            contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', color: '#000' }}
            labelStyle={{ color: '#000', fontWeight: 700 }}
            itemStyle={{ color: '#000' }}
            formatter={(value) => [`${value} units`, 'Stock']}
          />
          <Bar dataKey="value" fill="#fee2e2" radius={[8, 8, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}

function LowStockChart({ data }) {
  // data: [{ name, remaining }]
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} layout="vertical" margin={{ top: 6, right: 10, left: 10, bottom: 6 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={120}
            tick={{ fill: '#475569', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.03)' }}
            contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', color: '#000' }}
            labelStyle={{ color: '#000', fontWeight: 700 }}
            itemStyle={{ color: '#000' }}
            formatter={(value) => [`${value} kg`, 'Remaining']}
          />
          <Bar dataKey="remaining" fill="#fee2e2" radius={[8, 8, 8, 8]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HomePage() {
  // Mock data for now
  const totalPurchaseThisMonth = 128450
  const totalItemsTransferred = 342

  const purchasesTrend = [12, 14, 11, 18, 22, 19, 24, 28, 26, 31, 34, 38]
  const usageTrend = [9, 8, 10, 11, 12, 13, 12, 14, 15, 14, 16, 17]

  const stockByCategory = [
    { label: 'Dry', value: 72 },
    { label: 'Dairy', value: 46 },
    { label: 'Meat', value: 38 },
    { label: 'Veg', value: 58 },
    { label: 'Spice', value: 64 },
    { label: 'Frozen', value: 22 },
    { label: 'Beverage', value: 41 },
    { label: 'Bakery', value: 33 },
    { label: 'Seafood', value: 19 },
    { label: 'Cleaning', value: 27 },
  ]

  const lowStock = [
    { name: 'Olive oil', remaining: 12 },
    { name: 'Basmati rice', remaining: 18 },
    { name: 'Butter', remaining: 9 },
    { name: 'Chicken breast', remaining: 14 },
    { name: 'Tomato puree', remaining: 7 },
    { name: 'Black pepper', remaining: 6 },
  ]

  const money = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Purchase (This Month)" value={money(totalPurchaseThisMonth)} sublabel="Mock data" />
        <StatCard label="Total Items Transferred" value={String(totalItemsTransferred)} sublabel="Mock data" />
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchases trend</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700">Last 12 periods</div>
            <TrendChart points={purchasesTrend} color="#64748b" ariaLabel="Purchases trend" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Usage trend</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700">Last 12 periods</div>
            <TrendChart points={usageTrend} color="#94a3b8" ariaLabel="Usage trend" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Stock overview</h2>
            <div className="text-sm text-slate-600">By category (mock)</div>
          </div>
          <div className="mt-4">
            <StockBarChart data={stockByCategory} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Low stock</h2>
            <div className="text-sm text-slate-600">Sample items</div>
          </div>
          <div className="mt-4">
            <LowStockChart data={lowStock} />
          </div>
        </div>
      </div>
    </div>
  )
}

