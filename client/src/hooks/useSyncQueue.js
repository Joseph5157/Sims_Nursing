import { useState, useCallback, useEffect } from 'react';

const QUEUE_KEY = 'sync-queue';

/**
 * Hook to manage offline mutation queue
 * Stores mutations that fail due to offline, replays when online
 */
export function useSyncQueue() {
  const [queue, setQueue] = useState(() => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to load sync queue:', err);
      return [];
    }
  });

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('Failed to save sync queue:', err);
    }
  }, [queue]);

  const addToQueue = useCallback(
    (mutation) => {
      const id = Date.now().toString();
      const item = {
        id,
        ...mutation,
        timestamp: Date.now(),
        retries: 0,
      };
      setQueue((prev) => [...prev, item]);
      return id;
    },
    []
  );

  const removeFromQueue = useCallback((id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const processQueue = useCallback(async () => {
    if (queue.length === 0) return;

    const items = [...queue];
    const processed = [];

    for (const item of items) {
      try {
        // Execute the mutation function
        if (item.mutationFn && typeof item.mutationFn === 'function') {
          await item.mutationFn();
          processed.push(item.id);
        }
      } catch (err) {
        console.error(`Failed to process queued mutation ${item.id}:`, err);
        // Don't remove on error, will retry later
      }
    }

    // Remove processed items
    processed.forEach((id) => removeFromQueue(id));
  }, [queue, removeFromQueue]);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    processQueue,
  };
}
