const { PurchaseReportRequestSchema } = require('../models/purchase/reportSchema')
const { PurchaseReportService } = require('../services/purchaseReportService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

function formatZodError(err) {
  const first = err?.issues?.[0]
  return first?.message || 'Invalid request'
}

class PurchaseReportsController {
  purchaseAnalytics = async (req, res) => {
    const parsed = PurchaseReportRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) })
    }

    const filters = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!filters.organization_id) {
        return res.status(400).json({ error: 'organization_id is required' })
      }
    } else {
      filters.organization_id = req.user.organization_id
    }

    const service = new PurchaseReportService({ models: req.models })
    const data = await service.getAnalytics(filters)

    return res.json({
      message: 'Purchase analytics fetched successfully',
      data,
    })
  }

  purchaseTimeline = async (req, res) => {
    const parsed = PurchaseReportRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) })
    }

    const filters = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!filters.organization_id) {
        return res.status(400).json({ error: 'organization_id is required' })
      }
    } else {
      filters.organization_id = req.user.organization_id
    }

    const service = new PurchaseReportService({ models: req.models })
    const data = await service.getTimeline(filters)

    return res.json({
      message: 'Purchase timeline fetched successfully',
      data,
    })
  }
}

module.exports = { PurchaseReportsController }
