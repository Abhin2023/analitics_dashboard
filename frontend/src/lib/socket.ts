import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./authStore";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const token = useAuthStore.getState().token;
  if (!token) return null as unknown as Socket;

  socket = io(window.location.origin, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => console.log("[Socket] Connected:", socket?.id));
  socket.on("disconnect", (reason) => console.log("[Socket] Disconnected:", reason));
  socket.on("connect_error", (err) => console.warn("[Socket] Error:", err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
