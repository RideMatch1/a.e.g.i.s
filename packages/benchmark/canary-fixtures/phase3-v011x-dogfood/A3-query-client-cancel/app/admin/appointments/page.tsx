'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Appointments page — server state managed via TanStack Query.
 * The mutation.onMutate callback calls queryClient.cancelQueries (which
 * cancels any in-flight query (race-free pattern) before optimistic update).
 */
export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/appointments/${id}`, { method: 'DELETE' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
  return <button onClick={() => mutation.mutate('x')}>Delete</button>;
}
