/**
 * @typedef {Object} SendEmailOptions
 * @property {string | string[]} to Recipient address(es).
 * @property {string} [from] Sender address (falls back to provider default).
 * @property {string} subject Email subject.
 * @property {string} [html] HTML body.
 * @property {string} [text] Plain-text body.
 * @property {string} [replyTo] Reply-to address.
 * @property {Record<string, string>} [headers] Optional custom headers.
 * @property {string[]} [cc]
 * @property {string[]} [bcc]
 */

/**
 * @typedef {Object} EmailAttachment
 * @property {string} filename File name shown to the recipient.
 * @property {Buffer | string} [content] File bytes or Base64-encoded content.
 * @property {string} [path] Remote URL for the attachment.
 * @property {string} [contentType] MIME type (optional).
 */

/**
 * @typedef {SendEmailOptions & { attachments: EmailAttachment[] }} SendEmailWithAttachmentOptions
 */

/**
 * @typedef {Object} EmailSendResult
 * @property {boolean} success
 * @property {string} [messageId] Provider message identifier.
 * @property {string} provider Provider key (e.g. `resend`).
 */

/**
 * @typedef {Object} EmailVerifyResult
 * @property {boolean} ok
 * @property {string} provider
 * @property {string} [message]
 */

class EmailServiceError extends Error {
  /**
   * @param {string} message
   * @param {{ provider?: string, code?: string, statusCode?: number, cause?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'EmailServiceError'
    this.provider = meta.provider ?? null
    this.code = meta.code ?? null
    this.statusCode = meta.statusCode ?? null
    if (meta.cause !== undefined) this.cause = meta.cause
  }

  /**
   * @param {string} provider
   * @param {unknown} err
   * @returns {EmailServiceError}
   */
  static fromProvider(provider, err) {
    if (err instanceof EmailServiceError) return err

    const e = /** @type {{ message?: string, name?: string, statusCode?: number }} */ (err)
    const message =
      typeof e?.message === 'string' && e.message
        ? e.message
        : `Email send failed (${provider})`

    return new EmailServiceError(message, {
      provider,
      code: e?.name ?? null,
      statusCode: e?.statusCode ?? null,
      cause: err,
    })
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      provider: this.provider,
      code: this.code,
      statusCode: this.statusCode,
    }
  }
}

/**
 * @param {string | string[]} to
 * @returns {string[]}
 */
function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to]
  const cleaned = list.map((v) => String(v).trim()).filter(Boolean)
  if (!cleaned.length) {
    throw new EmailServiceError('At least one recipient is required', { code: 'INVALID_RECIPIENTS' })
  }
  return cleaned
}

/**
 * @param {SendEmailOptions} options
 */
function assertSendOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new EmailServiceError('Email options are required', { code: 'INVALID_OPTIONS' })
  }
  if (!options.subject || !String(options.subject).trim()) {
    throw new EmailServiceError('Email subject is required', { code: 'INVALID_SUBJECT' })
  }
  if (!options.html && !options.text) {
    throw new EmailServiceError('Email html or text body is required', { code: 'INVALID_BODY' })
  }
  normalizeRecipients(options.to)
}

module.exports = {
  EmailServiceError,
  normalizeRecipients,
  assertSendOptions,
}
