import { useEffect, useRef, useCallback, useState } from 'react';

export function useWebSocket(onEvent) {
    const wsRef = useRef(null);
    const reconnectTimeout = useRef(null);
    const retryCount = useRef(0);
    const [connected, setConnected] = useState(false);

    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                retryCount.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.event && onEvent) {
                        onEvent(data.event, data.data);
                    }
                } catch (e) {
                    console.warn('WebSocket parse error:', e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                wsRef.current = null;
                // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
                const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
                retryCount.current += 1;
                reconnectTimeout.current = setTimeout(connect, delay);
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch (e) {
            console.warn('WebSocket connection error:', e);
        }
    }, [onEvent]);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [connect]);

    return { connected };
}
