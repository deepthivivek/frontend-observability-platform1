import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export interface WebSocketEventMessage {
  type: 'trace_anomaly_detected' | 'topology_updated' | 'ping' | 'pong';
  payload: any;
  timestamp: number;
}

let wss: WebSocketServer | null = null;
const activeSockets = new Set<WebSocket>();

export function setupWebSocketGateway(server: HttpServer): WebSocketServer {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ server, path: '/ws/telemetry' });

  wss.on('connection', (ws: WebSocket, req) => {
    activeSockets.add(ws);

    // Send initial handshake
    ws.send(
      JSON.stringify({
        type: 'handshake_ack',
        payload: {
          clientIp: req.socket.remoteAddress,
          connectedAt: Date.now(),
          protocol: 'neon-chasm-ws-v1',
        },
        timestamp: Date.now(),
      })
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore unformatted socket messages
      }
    });

    ws.on('close', () => {
      activeSockets.delete(ws);
    });

    ws.on('error', () => {
      activeSockets.delete(ws);
    });
  });

  return wss;
}

export function broadcastTraceAnomaly(anomalyData: {
  traceId: string;
  serviceName: string;
  spanName: string;
  durationMs: number;
  zScore: number;
  rootCauseReason?: string;
  remediation?: string;
}) {
  const event: WebSocketEventMessage = {
    type: 'trace_anomaly_detected',
    payload: anomalyData,
    timestamp: Date.now(),
  };
  broadcastMessage(event);
}

export function broadcastTopologyUpdate(topologyData: any) {
  const event: WebSocketEventMessage = {
    type: 'topology_updated',
    payload: topologyData,
    timestamp: Date.now(),
  };
  broadcastMessage(event);
}

export function broadcastMessage(message: WebSocketEventMessage) {
  const jsonStr = JSON.stringify(message);
  for (const client of activeSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  }
}

export function getConnectedClientCount(): number {
  return activeSockets.size;
}

export function closeWebSocketGateway(): void {
  if (wss) {
    wss.close();
    wss = null;
    activeSockets.clear();
  }
}
