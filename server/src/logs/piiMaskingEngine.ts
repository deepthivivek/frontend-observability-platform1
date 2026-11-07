/**
 * Real-Time PII Scrubbing & Differential Privacy Masking Engine (Day 17)
 * Dynamically detects and tokenizes/masks sensitive tokens (API keys, auth headers, emails, bearer tokens, credit cards)
 * at the ingestion gateway before vector indexing or persistent storage.
 */

export class PIIMaskingEngine {
  private patterns: Array<{ name: string; regex: RegExp; replacement: string }> = [
    {
      name: 'BEARER_TOKEN',
      regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
      replacement: 'Bearer [REDACTED_AUTH_TOKEN]',
    },
    {
      name: 'API_KEY',
      regex: /(api[_-]?key|secret|token)["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{8,})["']?/gi,
      replacement: '$1="[REDACTED_API_KEY]"',
    },
    {
      name: 'EMAIL_ADDRESS',
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '[REDACTED_EMAIL]',
    },
    {
      name: 'CREDIT_CARD',
      regex: /\b(?:\d[ -]*?){13,16}\b/g,
      replacement: '[REDACTED_CREDIT_CARD]',
    },
  ];

  public scrubLogLine(rawLogLine: string): {
    scrubbedLogLine: string;
    tokensMasked: string[];
    hasMaskingOccurred: boolean;
  } {
    let currentText = rawLogLine;
    const tokensMasked: string[] = [];

    for (const pat of this.patterns) {
      if (pat.regex.test(currentText)) {
        tokensMasked.push(pat.name);
        currentText = currentText.replace(pat.regex, pat.replacement);
      }
    }

    return {
      scrubbedLogLine: currentText,
      tokensMasked,
      hasMaskingOccurred: tokensMasked.length > 0,
    };
  }
}

export const globalPIIMaskingEngine = new PIIMaskingEngine();
