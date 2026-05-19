/**
 * Provider-agnostic email service contract.
 * Concrete providers must extend this class and implement abstract methods.
 */
class EmailService {
  /**
   * @param {import('./types/EmailTypes').SendEmailOptions} _options
   * @returns {Promise<import('./types/EmailTypes').EmailSendResult>}
   */
  async send(_options) {
    throw new Error('send() must be implemented by the email provider')
  }

  /**
   * @param {import('./types/EmailTypes').SendEmailWithAttachmentOptions} _options
   * @returns {Promise<import('./types/EmailTypes').EmailSendResult>}
   */
  async sendWithAttachment(_options) {
    throw new Error('sendWithAttachment() must be implemented by the email provider')
  }

  /**
   * @param {import('./types/EmailTypes').SendEmailOptions & { templateId: string, variables?: Record<string, unknown> }} _options
   * @returns {Promise<import('./types/EmailTypes').EmailSendResult>}
   */
  async sendTemplate(_options) {
    throw new Error('sendTemplate() is not implemented for this email provider')
  }

  /**
   * @param {import('./types/EmailTypes').SendEmailOptions[]} _messages
   * @returns {Promise<import('./types/EmailTypes').EmailSendResult[]>}
   */
  async sendBulk(_messages) {
    throw new Error('sendBulk() is not implemented for this email provider')
  }

  /**
   * @returns {Promise<import('./types/EmailTypes').EmailVerifyResult>}
   */
  async verifyConnection() {
    throw new Error('verifyConnection() is not implemented for this email provider')
  }
}

module.exports = { EmailService }
