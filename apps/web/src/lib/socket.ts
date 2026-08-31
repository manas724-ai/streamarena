import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './api';

// One factory per namespace, each connecting lazily and carrying the JWT
// (when present) so the server can tell an identified user from a guest.
export function connectNamespace(namespace: '/chat' | '/rtc' | '/arena' | '/support', token?: string | null): Socket {
  return io(`${API_BASE}${namespace}`, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    autoConnect: true,
  });
}
