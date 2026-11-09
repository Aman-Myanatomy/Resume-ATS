import { useState } from 'react';

/** Public URL of a job on the board. */
export const publicJobLink = id => `${window.location.origin}/jobs/${id}`;

/**
 * Copy-to-clipboard with a short "Copied" state per item.
 *   const [copiedId, copy] = useCopy();  copy(id, text)
 */
export function useCopy() {
  const [copiedId, setCopiedId] = useState(null);
  const copy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt?.('Copy this link', text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(current => (current === id ? null : current)), 2000);
  };
  return [copiedId, copy];
}
