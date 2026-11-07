/**
 * Advanced LogQL AST Parser & Indexer (Day 17)
 * Implements a full Abstract Syntax Tree (AST) parser for LogQL supporting:
 * - Stream selectors: {app="checkout", level="error"}
 * - String filters: |= "timeout", != "auth"
 * - Regex matching: ~ "err_[0-9]+"
 * - Semantic vector search: ~* "connection timeout"
 * - Aggregation functions: rate(), count_over_time()
 */

import { LogQLQueryAST, LogQLSelector, LogQLFilter } from '../../../src/types/logEngine';

export class LogQLParser {
  public parseQuery(rawQuery: string): LogQLQueryAST {
    const trimmed = rawQuery.trim();
    const selectors: LogQLSelector[] = [];
    const filters: LogQLFilter[] = [];
    let aggregationFunction: 'rate' | 'count_over_time' | undefined = undefined;
    let aggregationWindow: string | undefined = undefined;
    let isSemanticVectorSearch = false;

    // Check for metric aggregation wrappers rate({}[5m]) or count_over_time({}[1m])
    const aggMatch = trimmed.match(/^(rate|count_over_time)\s*\((.+)\)/i);
    let innerQuery = trimmed;
    if (aggMatch) {
      aggregationFunction = aggMatch[1].toLowerCase() as 'rate' | 'count_over_time';
      innerQuery = aggMatch[2];

      const windowMatch = innerQuery.match(/\[([0-9]+[smhd])\]/);
      if (windowMatch) {
        aggregationWindow = windowMatch[1];
        innerQuery = innerQuery.replace(/\[[0-9]+[smhd]\]/, '').trim();
      }
    }

    // 1. Extract Stream Selectors {app="checkout", level="error"}
    const selectorMatch = innerQuery.match(/\{([^}]+)\}/);
    if (selectorMatch) {
      const rawSelectors = selectorMatch[1];
      const pairs = rawSelectors.split(',');
      for (const pair of pairs) {
        const pMatch = pair.match(/([a-zA-Z0-9_-]+)\s*(=|!=|=~|!~)\s*["']([^"']+)["']/);
        if (pMatch) {
          selectors.push({
            label: pMatch[1].trim(),
            operator: pMatch[2] as '=' | '!=' | '=~' | '!~',
            value: pMatch[3].trim(),
          });
        }
      }
    }

    // 2. Extract Pipeline Filters (|= "timeout", != "auth", ~ "err_[0-9]+", ~* "semantic query", |~* "query")
    const restOfQuery = innerQuery.replace(/\{[^}]+\}/, '');
    const filterRegex = /(\|~\*|~\*|\|=|!=|=~|!~|\|~|~)\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = filterRegex.exec(restOfQuery)) !== null) {
      const op = match[1] as '|=' | '!=' | '~' | '!~' | '~*' | '|~*';
      const pattern = match[2];
      if (op === '~*' || op === '|~*') {
        isSemanticVectorSearch = true;
      }
      filters.push({ operator: op, pattern });
    }

    return {
      rawQuery,
      selectors,
      filters,
      aggregationFunction,
      aggregationWindow,
      isSemanticVectorSearch,
    };
  }
}

export const globalLogQLParser = new LogQLParser();
