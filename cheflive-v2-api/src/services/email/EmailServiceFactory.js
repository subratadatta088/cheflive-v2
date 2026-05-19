const { ResendEmailService } = require('./providers/ResendEmailService')
const { EmailServiceError } = require('./types/EmailTypes')

/** @type {import('./EmailService').EmailService | null} */
let instance = null

function readEmailServiceProvider() {
  return (process.env.EMAIL_SERVICE || 'resend').trim().toLowerCase()
}

function createProvider() {
  const provider = readEmailServiceProvider()

  switch (provider) {
    case 'resend':
      return new ResendEmailService({
        apiKey: process.env.RESEND_API_KEY,
        defaultFrom: process.env.EMAIL_FROM,
      })
    case 'sendgrid':
    case 'ses':
    case 'mailgun':
      throw new EmailServiceError(`Email provider "${provider}" is not implemented yet`, {
        code: 'PROVIDER_NOT_IMPLEMENTED',
      })
    default:
      throw new EmailServiceError(`Unsupported EMAIL_SERVICE: ${provider}`, {
        code: 'UNSUPPORTED_PROVIDER',
      })
  }
}

class EmailServiceFactory {
  /**
   * Returns the configured email service singleton.
   * @returns {import('./EmailService').EmailService}
   */
  static getInstance() {
    if (!instance) {
      instance = createProvider()
    }
    return instance
  }

  /** Resets singleton (useful for tests). */
  static resetInstance() {
    instance = null
  }

  /** @returns {string} */
  static getProviderName() {
    return readEmailServiceProvider()
  }
}

module.exports = { EmailServiceFactory }
