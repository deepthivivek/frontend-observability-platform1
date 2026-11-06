import {
  RumSession,
  UncaughtExceptionGroup,
  SyntheticMonitor,
  DomEvent,
  MemoryProfileDataPoint,
} from '../types/rum';

export const SEED_RUM_SESSIONS: RumSession[] = [
  {
    id: 'session-prod-9941',
    userId: 'usr_enterprise_882',
    userEmail: 'dev.lead@fintech-corp.com',
    startTime: 1700000000000,
    durationMs: 45000, // 45 seconds
    device: 'Desktop',
    browser: 'Chrome 122',
    os: 'macOS Sonoma',
    networkTier: 'WiFi',
    country: 'US',
    frustrationScore: 88, // High frustration!
    rageClicksCount: 6,
    deadClicksCount: 2,
    errorsCount: 2,
    correlatedTraceId: '00-9941a88b77c6-01',
    events: [
      {
        id: 'evt-1',
        timestamp: 1200,
        type: 'navigation',
        targetSelector: 'window.location',
        targetText: '/checkout/review-order',
      },
      {
        id: 'evt-2',
        timestamp: 3400,
        type: 'input',
        targetSelector: '#billing-postal-code',
        inputValue: '94107',
      },
      {
        id: 'evt-3',
        timestamp: 5600,
        type: 'input',
        targetSelector: '#credit-card-number',
        inputValue: '••••••••••••4242', // Auto-redacted!
      },
      {
        id: 'evt-4',
        timestamp: 8200,
        type: 'click',
        targetSelector: 'button#btn-place-order',
        targetText: 'Complete Purchase ($1,250.00)',
        x: 640,
        y: 420,
      },
      {
        id: 'evt-5',
        timestamp: 8600,
        type: 'network_call',
        targetSelector: '/api/v1/checkout/charge',
        networkDetails: {
          method: 'POST',
          url: '/api/v1/checkout/charge',
          status: 504,
          durationMs: 1420,
          traceId: '00-9941a88b77c6-01',
        },
      },
      // Rage-Click sequence when button becomes unresponsive
      {
        id: 'evt-6',
        timestamp: 10100,
        type: 'rage_click',
        targetSelector: 'button#btn-place-order',
        targetText: 'Complete Purchase ($1,250.00)',
        x: 642,
        y: 421,
      },
      {
        id: 'evt-7',
        timestamp: 10250,
        type: 'rage_click',
        targetSelector: 'button#btn-place-order',
        targetText: 'Complete Purchase ($1,250.00)',
        x: 640,
        y: 422,
      },
      {
        id: 'evt-8',
        timestamp: 10380,
        type: 'rage_click',
        targetSelector: 'button#btn-place-order',
        targetText: 'Complete Purchase ($1,250.00)',
        x: 641,
        y: 420,
      },
      {
        id: 'evt-9',
        timestamp: 10520,
        type: 'rage_click',
        targetSelector: 'button#btn-place-order',
        targetText: 'Complete Purchase ($1,250.00)',
        x: 640,
        y: 420,
      },
      {
        id: 'evt-10',
        timestamp: 12000,
        type: 'error',
        targetSelector: 'window.onerror',
        errorMessage: "Uncaught TypeError: Cannot read properties of undefined (reading 'cartToken')",
      },
      {
        id: 'evt-11',
        timestamp: 14500,
        type: 'scroll',
        targetSelector: 'body',
        scrollDepth: 80,
      },
      {
        id: 'evt-12',
        timestamp: 16000,
        type: 'dead_click',
        targetSelector: 'div.promo-banner',
        targetText: 'Spring Sale 20% Off applied at checkout',
        x: 320,
        y: 180,
      },
    ],
    webVitals: {
      lcp: 3450, // Poor
      inp: 480, // Poor
      cls: 0.18, // Needs improvement
      fcp: 1400, // Good
      ttfb: 820, // Needs improvement
      slowElement: '<button id="btn-place-order" class="btn-primary">',
      networkLatencyAttribution: 1420,
      loafDuration: 360,
    },
    memoryProfile: [
      { timestamp: 0, jsHeapSizeMb: 32.4, domNodeCount: 1420, longTaskCount: 0 },
      { timestamp: 10000, jsHeapSizeMb: 45.1, domNodeCount: 2200, longTaskCount: 1 },
      { timestamp: 20000, jsHeapSizeMb: 78.6, domNodeCount: 4800, longTaskCount: 4 },
      { timestamp: 30000, jsHeapSizeMb: 124.2, domNodeCount: 8200, longTaskCount: 8 },
      { timestamp: 45000, jsHeapSizeMb: 168.0, domNodeCount: 11400, longTaskCount: 12 },
    ],
  },
  {
    id: 'session-prod-9942',
    userId: 'usr_retail_1044',
    userEmail: 'sarah.m@global-shop.de',
    startTime: 1700000050000,
    durationMs: 32000,
    device: 'Mobile',
    browser: 'Safari 17',
    os: 'iOS 17',
    networkTier: '4G',
    country: 'DE',
    frustrationScore: 24, // Low frustration
    rageClicksCount: 0,
    deadClicksCount: 1,
    errorsCount: 0,
    correlatedTraceId: '00-9942bb77cc88-02',
    events: [
      {
        id: 'evt-21',
        timestamp: 800,
        type: 'navigation',
        targetSelector: 'window.location',
        targetText: '/catalog/smartphones',
      },
      {
        id: 'evt-22',
        timestamp: 2100,
        type: 'scroll',
        targetSelector: 'div.product-grid',
        scrollDepth: 45,
      },
      {
        id: 'evt-23',
        timestamp: 4800,
        type: 'click',
        targetSelector: 'a.product-card-link',
        targetText: 'Pixel 9 Pro 256GB Obsidian',
        x: 180,
        y: 340,
      },
      {
        id: 'evt-24',
        timestamp: 5200,
        type: 'network_call',
        networkDetails: {
          method: 'GET',
          url: '/api/v1/products/pixel-9-pro',
          status: 200,
          durationMs: 85,
          traceId: '00-9942bb77cc88-02',
        },
        targetSelector: '/api/v1/products/pixel-9-pro',
      },
    ],
    webVitals: {
      lcp: 1650, // Good
      inp: 64, // Good
      cls: 0.02, // Good
      fcp: 890, // Good
      ttfb: 140, // Good
      slowElement: '<img class="product-hero-image" src="/img/pixel9.webp">',
      networkLatencyAttribution: 85,
      loafDuration: 18,
    },
    memoryProfile: [
      { timestamp: 0, jsHeapSizeMb: 24.1, domNodeCount: 850, longTaskCount: 0 },
      { timestamp: 15000, jsHeapSizeMb: 27.5, domNodeCount: 920, longTaskCount: 0 },
      { timestamp: 32000, jsHeapSizeMb: 29.8, domNodeCount: 980, longTaskCount: 0 },
    ],
  },
  {
    id: 'session-prod-9943',
    userId: 'usr_corp_5521',
    userEmail: 'kenji.t@tokyo-trade.jp',
    startTime: 1700000100000,
    durationMs: 60000,
    device: 'Desktop',
    browser: 'Chrome 122',
    os: 'Windows 11',
    networkTier: '5G',
    country: 'JP',
    frustrationScore: 65, // Moderate frustration
    rageClicksCount: 3,
    deadClicksCount: 3,
    errorsCount: 1,
    correlatedTraceId: '00-9943cc88dd99-03',
    events: [
      {
        id: 'evt-31',
        timestamp: 1000,
        type: 'navigation',
        targetSelector: 'window.location',
        targetText: '/analytics/realtime-dash',
      },
      {
        id: 'evt-32',
        timestamp: 3200,
        type: 'click',
        targetSelector: 'button#btn-refresh-dataset',
        targetText: 'Refresh Metrics',
        x: 480,
        y: 120,
      },
      {
        id: 'evt-33',
        timestamp: 3600,
        type: 'rage_click',
        targetSelector: 'button#btn-refresh-dataset',
        targetText: 'Refresh Metrics',
        x: 481,
        y: 121,
      },
    ],
    webVitals: {
      lcp: 2800, // Needs improvement
      inp: 240, // Needs improvement
      cls: 0.12, // Needs improvement
      fcp: 1100, // Good
      ttfb: 420, // Good
      slowElement: '<canvas id="telemetry-webgl-canvas">',
      networkLatencyAttribution: 380,
      loafDuration: 140,
    },
    memoryProfile: [
      { timestamp: 0, jsHeapSizeMb: 42.0, domNodeCount: 1800, longTaskCount: 0 },
      { timestamp: 20000, jsHeapSizeMb: 58.0, domNodeCount: 2400, longTaskCount: 2 },
      { timestamp: 40000, jsHeapSizeMb: 82.0, domNodeCount: 3200, longTaskCount: 3 },
      { timestamp: 60000, jsHeapSizeMb: 110.0, domNodeCount: 4100, longTaskCount: 5 },
    ],
  },
];

export const SEED_EXCEPTIONS: UncaughtExceptionGroup[] = [
  {
    id: 'exc-cart-undefined',
    signature: "TypeError: Cannot read properties of undefined (reading 'cartToken')",
    message: "Cannot read properties of undefined (reading 'cartToken')",
    count: 142,
    usersAffected: 89,
    firstSeen: 1700000000000 - 86400000 * 2,
    lastSeen: 1700000000000,
    minifiedStack: `TypeError: Cannot read properties of undefined (reading 'cartToken')
    at e.getCartToken (app.min.js:42:1894)
    at t.processOrderSubmission (bundle.vendors.min.js:18:421)
    at HTMLButtonElement.dispatch (framework.min.js:2:8914)`,
    unminifiedFrames: [
      {
        file: 'src/components/checkout/CheckoutModal.tsx',
        line: 112,
        column: 24,
        functionName: 'processOrderSubmission',
        sourceSnippet: [
          '110:   const handleSubmitOrder = async () => {',
          '111:     setIsSubmitting(true);',
          "112:     const token = sessionContext.cart.cartToken; // <-- CRASH: cart is undefined on session expiry",
          '113:     const response = await api.post("/checkout/charge", { token });',
          '114:     return response.data;',
          '115:   };',
        ],
        highlightedLine: 112,
      },
      {
        file: 'src/hooks/useCartSession.ts',
        line: 48,
        column: 16,
        functionName: 'getCartToken',
        sourceSnippet: [
          '46:   export function useCartSession() {',
          '47:     const [session, setSession] = useState(null);',
          '48:     return { cart: session.activeCart };',
          '49:   }',
        ],
        highlightedLine: 48,
      },
    ],
  },
  {
    id: 'exc-resize-observer',
    signature: 'ResizeObserver loop completed with undelivered notifications',
    message: 'ResizeObserver loop completed with undelivered notifications',
    count: 512,
    usersAffected: 320,
    firstSeen: 1700000000000 - 86400000 * 5,
    lastSeen: 1700000000000,
    minifiedStack: `Error: ResizeObserver loop completed with undelivered notifications
    at app.min.js:12:498`,
    unminifiedFrames: [
      {
        file: 'src/components/logs/RequestLogTable.tsx',
        line: 88,
        column: 12,
        functionName: 'handleResizeObserverLoop',
        sourceSnippet: [
          '86:   useEffect(() => {',
          '87:     const observer = new ResizeObserver((entries) => {',
          '88:       measureVirtualContainerHeight(entries[0]);',
          '89:     });',
        ],
        highlightedLine: 88,
      },
    ],
  },
];

export const SEED_SYNTHETIC_MONITORS: SyntheticMonitor[] = [
  {
    id: 'syn-checkout-flow',
    name: 'Critical E-Commerce Checkout Flow',
    targetUrl: 'https://checkout.enterprise-observability.io/flow',
    frequencyMinutes: 5,
    status: 'failing',
    lastRunTimestamp: 1700000000000,
    regions: [
      { regionId: 'us-east-1', name: 'US-East (N. Virginia)', latencyMs: 245, status: 'failing' },
      { regionId: 'eu-central-1', name: 'EU-Central (Frankfurt)', latencyMs: 310, status: 'failing' },
      { regionId: 'ap-southeast-1', name: 'AP-South (Singapore)', latencyMs: 185, status: 'ok' },
    ],
    steps: [
      { id: 'st-1', stepNumber: 1, name: 'Navigate to Storefront Catalog', status: 'passed', durationMs: 120 },
      { id: 'st-2', stepNumber: 2, name: 'Add SKU-9941 to Shopping Cart', status: 'passed', durationMs: 210 },
      { id: 'st-3', stepNumber: 3, name: 'Proceed to Checkout Review Step', status: 'passed', durationMs: 180 },
      {
        id: 'st-4',
        stepNumber: 4,
        name: 'Submit Payment & Verify HTTP 200 OK',
        status: 'failed',
        durationMs: 1450,
        assertionMessage: 'AssertionError: Expected HTTP status 200 OK, but received 504 Gateway Timeout',
      },
    ],
  },
  {
    id: 'syn-api-health',
    name: 'Primary API Gateway Health & Ingestion Canary',
    targetUrl: 'https://api.enterprise-observability.io/health',
    frequencyMinutes: 1,
    status: 'passing',
    lastRunTimestamp: 1700000000000,
    regions: [
      { regionId: 'us-east-1', name: 'US-East (N. Virginia)', latencyMs: 35, status: 'ok' },
      { regionId: 'eu-central-1', name: 'EU-Central (Frankfurt)', latencyMs: 42, status: 'ok' },
      { regionId: 'ap-southeast-1', name: 'AP-South (Singapore)', latencyMs: 68, status: 'ok' },
    ],
    steps: [
      { id: 'st-11', stepNumber: 1, name: 'Ping /health Endpoint', status: 'passed', durationMs: 35 },
      { id: 'st-12', stepNumber: 2, name: 'Validate Redis Connection Pool', status: 'passed', durationMs: 12 },
      { id: 'st-13', stepNumber: 3, name: 'Assert Status OK & Latency < 100ms', status: 'passed', durationMs: 8 },
    ],
  },
];
