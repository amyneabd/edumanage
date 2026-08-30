import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "../api/auth";

export function useAuth() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 30_000,
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isAuthenticated: !query.isError && !!query.data,
    refetch: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  };
}
