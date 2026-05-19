const { Resend } = require('resend')
const { EmailService } = require('../EmailService')
const log = require('../../../handlers/logger')
const {
  EmailServiceError,
  normalizeRecipients,
  assertSendOptions,
} = require('../types/EmailTypes')

const PROVIDER = 'resend'

/**
 * Resend-backed email provider. SDK client is initialized once per instance.
 */
class ResendEmailService extends EmailService {
  /**
   * @param {{ apiKey: string, defaultFrom: string }} config
   */
  constructor(config) {
    super()
    const apiKey = config?.apiKey?.trim()
    if (!apiKey) {
      throw new EmailServiceError('RESEND_API_KEY is required when EMAIL_SERVICE=resend', {
        provider: PROVIDER,
        code: 'MISSING_API_KEY',
      })
    }

    this.defaultFrom = config.defaultFrom?.trim() || 'onboarding@resend.dev'
    this.client = new Resend(apiKey)
  }

  /**
   * @param {import('../types/EmailTypes').SendEmailOptions} options
   * @returns {Promise<import('../types/EmailTypes').EmailSendResult>}
   */
  async send(options) {
    assertSendOptions(options)
    const payload = this.#buildPayload(options)

    try {
      const { data, error } = await this.client.emails.send(payload)
      if (error) {
        throw EmailServiceError.fromProvider(PROVIDER, error)
      }

      log.info('email.sent', {
        provider: PROVIDER,
        messageId: data?.id ?? null,
        to: payload.to,
        subject: payload.subject,
      })

      return {
        success: true,
        messageId: data?.id,
        provider: PROVIDER,
      }
    } catch (err) {
      log.error('email.send_failed', {
        provider: PROVIDER,
        subject: options.subject,
        error: err instanceof EmailServiceError ? err.toJSON() : String(err),
      })
      throw err instanceof EmailServiceError ? err : EmailServiceError.fromProvider(PROVIDER, err)
    }
  }

  /**
   * @param {import('../types/EmailTypes').SendEmailWithAttachmentOptions} options
   * @returns {Promise<import('../types/EmailTypes').EmailSendResult>}
   */
  async sendWithAttachment(options) {
    if (!options?.attachments?.length) {
      throw new EmailServiceError('At least one attachment is required', {
        provider: PROVIDER,
        code: 'INVALID_ATTACHMENTS',
      })
    }

    assertSendOptions(options)
    const payload = {
      ...this.#buildPayload(options),
      attachments: this.#mapAttachments(options.attachments),
    }

    try {
      const { data, error } = await this.client.emails.send(payload)
      if (error) {
        throw EmailServiceError.fromProvider(PROVIDER, error)
      }

      log.info('email.sent_with_attachment', {
        provider: PROVIDER,
        messageId: data?.id ?? null,
        to: payload.to,
        subject: payload.subject,
        attachmentCount: payload.attachments.length,
      })

      return {
        success: true,
        messageId: data?.id,
        provider: PROVIDER,
      }
    } catch (err) {
      log.error('email.send_with_attachment_failed', {
        provider: PROVIDER,
        subject: options.subject,
        error: err instanceof EmailServiceError ? err.toJSON() : String(err),
      })
      throw err instanceof EmailServiceError ? err : EmailServiceError.fromProvider(PROVIDER, err)
    }
  }

  /**
   * @returns {Promise<import('../types/EmailTypes').EmailVerifyResult>}
   */
  async verifyConnection() {
    try {
      const { error } = await this.client.domains.list()
      if (error) {
        throw EmailServiceError.fromProvider(PROVIDER, error)
      }
      return { ok: true, provider: PROVIDER, message: 'Resend API connection verified' }
    } catch (err) {
      log.error('email.verify_failed', {
        provider: PROVIDER,
        error: err instanceof EmailServiceError ? err.toJSON() : String(err),
      })
      throw err instanceof EmailServiceError ? err : EmailServiceError.fromProvider(PROVIDER, err)
    }
  }

  /**
   * @param {import('../types/EmailTypes').SendEmailOptions} options
   */
  #buildPayload(options) {
    const to = normalizeRecipients(options.to)
    const payload = {
      from: options.from?.trim() || this.defaultFrom,
      to,
      subject: String(options.subject).trim(),
    }

    if (options.html) payload.html = options.html
    if (options.text) payload.text = options.text
    if (options.replyTo) payload.reply_to = options.replyTo
    if (options.cc?.length) payload.cc = options.cc
    if (options.bcc?.length) payload.bcc = options.bcc
    if (options.headers) payload.headers = options.headers

    return payload
  }

  /**
   * @param {import('../types/EmailTypes').EmailAttachment[]} attachments
   */
  #mapAttachments(attachments) {
    return attachments.map((file) => {
      if (!file?.filename?.trim()) {
        throw new EmailServiceError('Attachment filename is required', {
          provider: PROVIDER,
          code: 'INVALID_ATTACHMENT',
        })
      }

      const mapped = { filename: file.filename.trim() }
      if (file.path) {
        mapped.path = file.path
      } else if (file.content !== undefined) {
        mapped.content =
          Buffer.isBuffer(file.content) ? file.content.toString('base64') : String(file.content)
      } else {
        throw new EmailServiceError('Attachment content or path is required', {
          provider: PROVIDER,
          code: 'INVALID_ATTACHMENT',
        })
      }

      if (file.contentType) mapped.content_type = file.contentType
      return mapped
    })
  }
}

module.exports = { ResendEmailService }
