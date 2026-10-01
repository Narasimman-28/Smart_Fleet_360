import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Response } from 'express';

export interface LiveLocationBroadcastPayload {
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  vehicle_id?: string | null;
  vehicle_number?: string | null;
  make?: string | null;
  model?: string | null;
  booking_id?: string | null;
  booking_number?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  location_name?: string | null;
  source: 'GPS' | 'MANUAL';
  provider?: string;
  is_tracking: number;
  tracking_status: 'ACTIVE' | 'STOPPED' | 'OFFLINE';
  gps_status: 'CONNECTED' | 'OFFLINE' | 'DELAYED' | 'ON TRIP' | 'AVAILABLE';
  trip_status?: string | null;
  last_updated: string;
  minutes_since_update: number;
}

export class LiveTrackingSocketService {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();
  private static sseClients: Set<Response> = new Set();

  public static initialize(server: HttpServer) {
    if (this.wss) return;

    this.wss = new WebSocketServer({
      server,
      path: '/api/driver-tracking/socket'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      // console.log(`[WebSocket] Live tracking dashboard client connected from ${clientIp}`);

      this.clients.add(ws);

      // Send initial welcome & connection confirmation
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'SmartFleet 360 Live Tracking Real-Time Stream Connected',
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch {
          // Ignore malformed text
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // Periodic heartbeat (every 30 seconds)
    setInterval(() => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        } else {
          this.clients.delete(client);
        }
      });
    }, 30000);

    console.log('[WebSocket Engine] Real-time tracking WebSocket server mounted on /api/driver-tracking/socket');
  }

  // Register Server-Sent Events (SSE) Client
  public static addSSEClient(res: Response) {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  // Broadcast location update to all connected dashboard clients
  public static broadcastLocation(payload: LiveLocationBroadcastPayload) {
    const message = JSON.stringify({
      type: 'LOCATION_UPDATE',
      payload,
      timestamp: new Date().toISOString()
    });

    // 1. Broadcast over WebSocket
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch {
          this.clients.delete(client);
        }
      }
    });

    // 2. Broadcast over Server-Sent Events
    this.sseClients.forEach(res => {
      try {
        res.write(`data: ${message}\n\n`);
      } catch {
        this.sseClients.delete(res);
      }
    });
  }

  // Broadcast driver connection status changes (e.g. Connected, Disconnected, Offline)
  public static broadcastStatusChange(driverId: string, status: string, trackingStatus: string, driverName?: string) {
    const message = JSON.stringify({
      type: 'STATUS_CHANGE',
      payload: {
        driver_id: driverId,
        driver_name: driverName,
        status,
        tracking_status: trackingStatus,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    this.sseClients.forEach(res => {
      try {
        res.write(`data: ${message}\n\n`);
      } catch {
        this.sseClients.delete(res);
      }
    });
  }

  public static getActiveClientCount(): { wsCount: number; sseCount: number } {
    return {
      wsCount: this.clients.size,
      sseCount: this.sseClients.size
    };
  }
}
