import { useEffect, useState } from 'react'
import { listIngredients, listIngredientUnitConversions } from '../../../apis/ingredient.js'
import { buildIngredientLabel } from '../../utilizations/utilizationFormUtils.js'

/**
 * @param {Record<string, { id: number, item_code?: unknown, name?: string, unit?: string }>} [seedById]
 */
export function usePreparationIngredientLookup(seedById = {}) {
  const [ingredientOptions, setIngredientOptions] = useState([])
  const [ingredientsById, setIngredientsById] = useState(() => ({ ...seedById }))
  const [ingredientSearch, setIngredientSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = ingredientSearch.trim() || undefined
          const { items } = await listIngredients({ q, limit: 20 })
          if (cancelled) return
          const fresh = []
          const byIdDelta = {}
          for (const it of Array.isArray(items) ? items : []) {
            const id = Number(it?.id)
            if (!Number.isFinite(id) || id <= 0) continue
            const ing = {
              id,
              item_code: it?.item_code ?? null,
              name: it?.name ?? '',
              unit: it?.unit ?? '',
            }
            byIdDelta[String(id)] = ing
            fresh.push(ing)
          }
          setIngredientsById((prev) => ({ ...prev, ...byIdDelta }))
          setIngredientOptions(
            fresh.map((x) => ({ value: String(x.id), label: buildIngredientLabel(x) })),
          )
        } catch {
          if (!cancelled) setIngredientOptions([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ingredientSearch])

  const loadUnitOptionsForIngredient = async (ingredientId) => {
    const key = String(ingredientId)
    const ing = ingredientsById[key]
    const baseUnit = ing?.unit ? String(ing.unit) : ''
    const units = []
    if (baseUnit) units.push(baseUnit)
    try {
      const convData = await listIngredientUnitConversions(key)
      const convItems = Array.isArray(convData?.items) ? convData.items : []
      for (const c of convItems) {
        const from = c?.from_unit ? String(c.from_unit) : ''
        const to = c?.to_unit ? String(c.to_unit) : ''
        if (from) units.push(from)
        if (to) units.push(to)
      }
    } catch {
      // ignore
    }
    const uniq = [...new Set(units)]
    return {
      baseUnit,
      unitOptions: uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null,
    }
  }

  return {
    ingredientOptions,
    ingredientsById,
    setIngredientsById,
    ingredientSearch,
    setIngredientSearch,
    loadUnitOptionsForIngredient,
  }
}
