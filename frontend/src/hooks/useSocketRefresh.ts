import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../lib/authStore";

export function useSocketRefresh(queryKeys?: string[]) {
  const queryClient = useQueryClient();
  // Presence, not value — a silent token refresh shouldn't tear down and
  // re-subscribe the listener.
  const isAuthenticated = useAuthStore((s) => !!s.token);

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    const handleRefresh = () => {
      if (queryKeys && queryKeys.length > 0) {
        queryKeys.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        );
      } else {
        queryClient.invalidateQueries();
      }
    };

    socket.on("data:refresh", handleRefresh);
    return () => {
      socket.off("data:refresh", handleRefresh);
    };
  }, [isAuthenticated, queryClient, queryKeys]);
}
