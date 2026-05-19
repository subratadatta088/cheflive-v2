const fs = require('fs')
const path = require('path')
const {
  PURCHASE_REPORT_TEMPLATE_ID,
  renderPurchaseReportHtml,
  buildPurchaseReportEmailContext,
} = require('./templateBuilders/PurchaseReportTemplate')

const TEMPLATES_DIR = path.join(__dirname, 'templates')

function listTemplateNames() {
  if (!fs.existsSync(TEMPLATES_DIR)) return []
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((name) => name.endsWith('.hbs'))
    .map((name) => name.replace(/\.hbs$/, ''))
}

function getMockPurchaseReportPayload() {
  const fromDate = '2026-05-10'
  const toDate = '2026-05-10'

  const table = [
    {
      ingredient_name: 'Foil Container (small)',
      unit: 'pack',
      total_quantity: 50,
      avg_rate: 120,
      total_spend: 6000,
      spend_percentage: 34.9,
      rate_variance: 0,
    },
    {
      ingredient_name: 'Foil Container (Large)',
      unit: 'pack',
      total_quantity: 25,
      avg_rate: 225,
      total_spend: 5625,
      spend_percentage: 32.7,
      rate_variance: 0,
    },
    {
      ingredient_name: 'Cumin Powder (Jeera)',
      unit: '500gm',
      total_quantity: 20,
      avg_rate: 170,
      total_spend: 3400,
      spend_percentage: 19.8,
      rate_variance: 0,
    },
    {
      ingredient_name: 'Posto',
      unit: 'pack 50gm',
      total_quantity: 5,
      avg_rate: 95,
      total_spend: 475,
      spend_percentage: 2.8,
      rate_variance: 0,
    },
    {
      ingredient_name: 'Kochu (taro)',
      unit: 'pc',
      total_quantity: 15,
      avg_rate: 25,
      total_spend: 375,
      spend_percentage: 2.2,
      rate_variance: 0,
    },
    {
      ingredient_name: 'Ladies Finger',
      unit: 'kg',
      total_quantity: 7,
      avg_rate: 45,
      total_spend: 270,
      spend_percentage: 1.6,
      rate_variance: 30,
    },
    {
      ingredient_name: 'Lemon',
      unit: 'pc',
      total_quantity: 72,
      avg_rate: 3,
      total_spend: 216,
      spend_percentage: 1.3,
      rate_variance: 0,
    },
  ]

  return {
    fromDate,
    toDate,
    generatedAt: new Date(`${toDate}T12:00:00.000Z`),
    analytics: {
      kpis: {
        total_purchase_amount: 17181,
        total_purchase_entries: 6,
        total_unique_ingredients: 12,
        highest_spend_ingredient: {
          ingredient_name: 'Foil Container (small)',
          total_spend: 6000,
          total_quantity: 50,
          unit: 'pack',
          spend_percentage: 34.9,
        },
        most_frequently_purchased_ingredient: {
          ingredient_name: 'Lemon',
          purchase_frequency: 4,
          total_quantity: 72,
          unit: 'pc',
          total_spend: 216,
        },
        most_volatile_ingredient: {
          ingredient_name: 'Ladies Finger',
          rate_spread: 30,
          lowest_rate: 30,
          lowest_rate_qty: 5,
          lowest_rate_unit: 'kg',
          highest_rate: 60,
          highest_rate_qty: 2,
          highest_rate_unit: 'kg',
        },
        top_5_spend_contribution_percentage: 92.4,
      },
      table,
      charts: {
        top_spend_distribution: table.slice(0, 5).map((row) => ({
          ingredient_name: row.ingredient_name,
          total_spend: row.total_spend,
          total_quantity: row.total_quantity,
          unit: row.unit,
          percentage: row.spend_percentage,
        })),
      },
      highlights: [
        'Top 5 ingredients contribute 92.4% of total purchase spend',
        'Foil Container (small) is the highest invested ingredient (34.9% of spend)',
        'Ladies Finger has the widest rate spread (INR 30)',
        'Foil Container (Large) is the second largest spend category (32.7%)',
      ],
    },
    timeline: {
      items: [
        {
          date: fromDate,
          total_purchase_amount: 17181,
          total_purchase_entries: 6,
          total_purchase_items: 16,
          total_quantity: 211.1,
        },
      ],
    },
  }
}

/**
 * @param {string} templateName Template id (e.g. `purchase-report`).
 * @returns {{ subject: string, html: string }}
 */
function buildMockEmail(templateName) {
  const normalized = String(templateName ?? '')
    .trim()
    .replace(/\.hbs$/i, '')

  if (!normalized) {
    throw new Error('Template name is required')
  }

  const available = listTemplateNames()
  if (!available.includes(normalized)) {
    throw new Error(
      `Unknown template "${normalized}". Available templates: ${available.join(', ') || '(none)'}`,
    )
  }

  switch (normalized) {
    case PURCHASE_REPORT_TEMPLATE_ID: {
      const payload = getMockPurchaseReportPayload()
      const context = buildPurchaseReportEmailContext(payload)
      return {
        subject: `[Mock] ${context.title}`,
        html: renderPurchaseReportHtml(payload),
      }
    }
    default:
      throw new Error(`No mock data registered for template "${normalized}"`)
  }
}

module.exports = {
  listTemplateNames,
  buildMockEmail,
  getMockPurchaseReportPayload,
}
