import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
    : 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') return null as any;

  const token = localStorage.getItem('freere_token');

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      auth: { token },
    });
  } else {
    const currentToken = (socket.auth as any)?.token;
    if (token && currentToken !== token) {
      socket.auth = { token };
      if (socket.disconnected) {
        socket.connect();
      } else {
        socket.disconnect().connect();
      }
    } else if (token && socket.disconnected) {
      socket.auth = { token };
      socket.connect();
    }
  }

  return socket;
}

export function updateSocketAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    const tokenVal = token || localStorage.getItem('freere_token');
    if (socket) {
      socket.auth = { token: tokenVal };
      if (socket.disconnected) {
        socket.connect();
      } else {
        socket.disconnect().connect();
      }
    } else {
      getSocket();
    }
  }
}

