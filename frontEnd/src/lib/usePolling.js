import { useEffect, useState } from 'react';

/**
 * Returns a pollingInterval for an RTK Query hook that is `ms` while `active`, else 0.
 *
 *   const [poll, setActive] = usePolling(4000);
 *   const { data } = useSomeQuery(arg, { pollingInterval: poll });
 *   setActive(data?.some(isPending));
 */
export function usePolling(ms) {
  const [active, setActive] = useState(false);
  return [active ? ms : 0, setActive];
}

/** Convenience: keep polling while `predicate(data)` is true. */
export function usePollWhile(data, predicate, setActive) {
  const active = Boolean(data && predicate(data));
  useEffect(() => { setActive(active); }, [active, setActive]);
}
