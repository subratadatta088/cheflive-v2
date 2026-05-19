const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const log = require('../../handlers/logger')

/** @type {EmailTemplateService | null} */
let instance = null

function registerDefaultHelpers() {
  if (Handlebars.helpers.currencyInr) return

  Handlebars.registerHelper('currencyInr', (value) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  })

  Handlebars.registerHelper('number', (value, decimals) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    const d = decimals != null ? Number(decimals) : 1
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    })
  })

  Handlebars.registerHelper('percent', (value) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    return `${n.toFixed(1)}%`
  })

  Handlebars.registerHelper('eq', (a, b) => a === b)
}

class EmailTemplateService {
  /**
   * @param {{ templatesDir?: string }} [options]
   */
  constructor(options = {}) {
    this.templatesDir =
      options.templatesDir || path.join(__dirname, 'templates')
    /** @type {Map<string, HandlebarsTemplateDelegate>} */
    this.compiled = new Map()
    registerDefaultHelpers()
  }

  /**
   * @returns {EmailTemplateService}
   */
  static getInstance() {
    if (!instance) {
      instance = new EmailTemplateService()
    }
    return instance
  }

  static resetInstance() {
    instance = null
  }

  /**
   * @param {string} templateName File name without extension (e.g. `purchase-report`).
   */
  resolveTemplatePath(templateName) {
    const safe = String(templateName).replace(/[^a-z0-9-_]/gi, '')
    const filePath = path.join(this.templatesDir, `${safe}.hbs`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Email template not found: ${safe}.hbs`)
    }
    return filePath
  }

  /**
   * @param {string} templateName
   * @returns {HandlebarsTemplateDelegate}
   */
  compile(templateName) {
    const key = String(templateName)
    if (this.compiled.has(key)) {
      return this.compiled.get(key)
    }

    const filePath = this.resolveTemplatePath(key)
    const source = fs.readFileSync(filePath, 'utf8')
    const template = Handlebars.compile(source, { strict: true })
    this.compiled.set(key, template)

    log.info('email.template_compiled', { template: key })
    return template
  }

  /**
   * @param {string} templateName
   * @param {Record<string, unknown>} context
   * @returns {string}
   */
  render(templateName, context) {
    try {
      const template = this.compile(templateName)
      return template(context ?? {})
    } catch (err) {
      log.error('email.template_render_failed', {
        template: templateName,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}

module.exports = { EmailTemplateService }
