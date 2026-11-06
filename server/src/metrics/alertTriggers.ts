import { evaluateMetricQuery } from './aggregator';

export interface WidgetAlertStatus {
  widgetId: string;
  widgetTitle: string;
  triggered: boolean;
  severity?: 'warning' | 'critical';
  currentValue: number;
  message?: string;
  evaluatedAt: number;
}

export function evaluateWidgetAlertTriggers(widgets: Array<{
  id: string;
  title: string;
  query: { expression: string; metric?: string };
  threshold?: { operator: '>' | '<' | '='; warning?: number; critical?: number };
}>): WidgetAlertStatus[] {
  const results: WidgetAlertStatus[] = [];

  for (const widget of widgets) {
    if (!widget.threshold) {
      results.push({
        widgetId: widget.id,
        widgetTitle: widget.title,
        triggered: false,
        currentValue: 0,
        evaluatedAt: Date.now(),
      });
      continue;
    }

    const evalResult = evaluateMetricQuery({
      query: widget.query.expression,
      metric: widget.query.metric,
      threshold: widget.threshold,
    });

    const isTriggered = evalResult.status !== 'ok';

    results.push({
      widgetId: widget.id,
      widgetTitle: widget.title,
      triggered: isTriggered,
      severity: isTriggered && (evalResult.status === 'warning' || evalResult.status === 'critical') ? evalResult.status : undefined,
      currentValue: evalResult.currentValue,
      message: evalResult.thresholdAlert?.message,
      evaluatedAt: Date.now(),
    });
  }

  return results;
}
