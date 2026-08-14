import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../lib/authStore";

export function useSocketRefresh(queryKeys?: string[]) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

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
  }, [token, queryClient, queryKeys]);
}
