const { EmailService } = require('./EmailService')
const { EmailServiceFactory } = require('./EmailServiceFactory')
const { EmailTemplateService } = require('./EmailTemplateService')
const { EmailServiceError } = require('./types/EmailTypes')
const {
  PURCHASE_REPORT_TEMPLATE_ID,
  buildPurchaseReportEmailContext,
  renderPurchaseReportHtml,
} = require('./templateBuilders/PurchaseReportTemplate')
const { buildMockEmail, listTemplateNames } = require('./mockTemplateData')

module.exports = {
  EmailService,
  EmailServiceFactory,
  EmailTemplateService,
  EmailServiceError,
  PURCHASE_REPORT_TEMPLATE_ID,
  buildPurchaseReportEmailContext,
  renderPurchaseReportHtml,
  buildMockEmail,
  listTemplateNames,
}
