import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./authStore";

let socket: Socket | null = null;

export function getSocket(): Socket {
  // Reuse the existing instance even while it's still connecting/reconnecting
  // (socket.connected is false during that window) — socket.io-client's own
  // reconnection logic re-authenticates with the latest token on each
  // attempt via the auth callback below, so tearing down and recreating
  // here on every call would only race multiple callers against each other.
  if (socket) return socket;

  if (!useAuthStore.getState().token) return null as unknown as Socket;

  socket = io(window.location.origin, {
    auth: (cb) => cb({ token: useAuthStore.getState().token }),
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
