import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  authControllerGetMe,
  authControllerSignOut,
  authControllerSignOutEverywhere,
  getAuthControllerGetMeQueryKey,
  type MeDto,
} from '@tarbya/api-client';

/** The signed-in user. A 401 here (after one silent refresh) means "signed out". */
export const meQuery = queryOptions({
  queryKey: getAuthControllerGetMeQueryKey(),
  queryFn: async ({ signal }) =>
    (await authControllerGetMe({ signal })).data as MeDto,
  staleTime: 5 * 60_000,
  retry: false,
});

/** Only inside the signed-in area, where the route guard has loaded it. */
export function useMe(): MeDto {
  return useSuspenseQuery(meQuery).data;
}

export function useSignOut(everywhere = false) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () =>
      everywhere ? authControllerSignOutEverywhere() : authControllerSignOut(),
    onSettled: async () => {
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });
}
