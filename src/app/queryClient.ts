import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The OASA client already retries once
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
})
