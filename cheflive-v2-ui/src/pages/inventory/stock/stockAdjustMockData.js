/** Static rows for adjust-stock modal (API integration later). */
export const MOCK_STOCK_ADJUST_ROWS = [
  {
    id: 'mock-1',
    ingredient_id: '1',
    ingredient_label: 'Basmati rice',
    current_stock: '120',
    adjusted_stock: '120',
    remarks: '',
    unit: 'kg',
  },
  {
    id: 'mock-2',
    ingredient_id: '2',
    ingredient_label: 'Olive oil',
    current_stock: '12',
    adjusted_stock: '12',
    remarks: '',
    unit: 'L',
  },
  {
    id: 'mock-3',
    ingredient_id: '3',
    ingredient_label: 'Butter',
    current_stock: '9',
    adjusted_stock: '9',
    remarks: '',
    unit: 'kg',
  },
]

export function createMockAdjustRow() {
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredient_id: '',
    ingredient_label: '',
    current_stock: '',
    adjusted_stock: '',
    remarks: '',
    unit: '',
  }
}
