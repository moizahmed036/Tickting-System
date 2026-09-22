'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from './api';
import { WebSocketEventPayload } from './types';

// Subtle Web Audio API Chime generator
function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext autoplay restrictions or disabled
  }
}

export interface StoredNotification extends WebSocketEventPayload {
  id: string;
  read: boolean;
  receivedAt: string;
}

export function useWebSocket(onEventReceived?: (event: WebSocketEventPayload) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(1000);
  const maxBackoff = 16000;
  const onEventRef = useRef(onEventReceived);

  useEffect(() => {
    onEventRef.current = onEventReceived;
  }, [onEventReceived]);

  // Load cached notifications from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('nexusflow_notifications');
        if (saved) {
          setNotifications(JSON.parse(saved).slice(0, 30));
        }
      } catch (e) {
        // ignore storage parse error
      }
    }
  }, []);

  const saveNotifications = useCallback((items: StoredNotification[]) => {
    setNotifications(items);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexusflow_notifications', JSON.stringify(items.slice(0, 30)));
      } catch (e) {}
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const token = api.getToken();
    if (!token) {
      setIsConnected(false);
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}:8000/api/v1/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        backoffRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketEventPayload = JSON.parse(event.data);
          
          // Handle Heartbeat Pong
          if ((data as any).type === 'PONG') return;

          // Play subtle sound alert
          playNotificationChime();

          const newNotif: StoredNotification = {
            ...data,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            read: false,
            receivedAt: new Date().toISOString(),
          };

          setNotifications((prev) => {
            const updated = [newNotif, ...prev].slice(0, 40);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('nexusflow_notifications', JSON.stringify(updated));
              } catch (e) {}
            }
            return updated;
          });

          // Trigger Sonner Toast
          const isBreach = data.type === 'SLA_BREACH';
          const isNew = data.type === 'NEW_TICKET';
          const isInternal = data.is_internal;

          const toastTitle = isBreach
            ? `⚠️ SLA Breach Alert: ${data.ticket_number}`
            : isNew
            ? `✨ New Ticket: ${data.ticket_number}`
            : isInternal
            ? `🔒 Staff Note: ${data.ticket_number}`
            : `🔔 Ticket Update: ${data.ticket_number}`;

          toast(toastTitle, {
            description: data.message,
            action: {
              label: 'View Ticket',
              onClick: () => {
                if (data.ticket_id) {
                  window.location.href = `/tickets/${data.ticket_id}`;
                }
              },
            },
            duration: 6000,
          });

          // Dispatch consumer callback if provided
          if (onEventRef.current) {
            onEventRef.current(data);
          }
        } catch (err) {
          console.warn('[WS] Error processing message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Exponential backoff reconnect
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 1.5, maxBackoff);
          connect();
        }, backoffRef.current);
      };

      ws.onerror = (err) => {
        console.warn('[WS] Socket error occurred');
        ws.close();
      };
    } catch (err) {
      console.warn('[WS] Failed to instantiate WebSocket:', err);
    }
  }, []);

  useEffect(() => {
    connect();

    // Heartbeat ping loop every 25 seconds
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING' }));
        } catch (e) {}
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const clearAll = useCallback(() => {
    saveNotifications([]);
  }, [saveNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
