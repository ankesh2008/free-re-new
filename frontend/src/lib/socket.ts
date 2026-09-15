import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
    : 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const token = localStorage.getItem('freere_token');

    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token },
    });
  }
  return socket!;
}

export function updateSocketAuthToken(token: string) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
}
