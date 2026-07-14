/**
 * Storage module for Health Tracker
 * Handles local storage for offline capabilities and interacts with the API for Redis sync.
 */

const STORAGE_KEY = 'health_tracker_logs';

/**
 * Get all food logs from local storage
 * @returns {Array} List of food logs
 */
export function getLocalLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading local storage', error);
    return [];
  }
}

/**
 * Save a single log to local storage and queue for sync
 * @param {Object} log - The food log entry
 */
export function addLocalLog(log) {
  if (typeof window === 'undefined') return;
  const logs = getLocalLogs();
  
  // Assign ID and timestamp if not present
  const entry = {
    ...log,
    id: log.id || crypto.randomUUID(),
    timestamp: log.timestamp || new Date().toISOString(),
    synced: false
  };

  logs.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  
  // Attempt sync
  syncWithServer();
}

/**
 * Overwrite local logs with server data
 * @param {Array} serverLogs - List of logs from server
 */
export function setLocalLogs(serverLogs) {
  if (typeof window === 'undefined') return;
  const withSyncFlag = serverLogs.map(l => ({ ...l, synced: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(withSyncFlag));
}

/**
 * Sync unsynced local logs with the Redis backend via API
 */
export async function syncWithServer() {
  if (typeof window === 'undefined') return;
  
  const logs = getLocalLogs();
  const unsynced = logs.filter(l => !l.synced);
  
  if (unsynced.length === 0) return;

  try {
    const response = await fetch('/api/logs/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: unsynced })
    });

    if (response.ok) {
      // Mark as synced
      const updatedLogs = logs.map(l => {
        if (unsynced.find(u => u.id === l.id)) {
          return { ...l, synced: true };
        }
        return l;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
    }
  } catch (error) {
    console.warn('Sync failed, will retry later.', error);
  }
}

/**
 * Fetch all logs from the server
 */
export async function fetchServerLogs() {
  try {
    const response = await fetch('/api/logs');
    if (response.ok) {
      const data = await response.json();
      setLocalLogs(data.logs || []);
      return data.logs;
    }
  } catch (error) {
    console.error('Failed to fetch server logs', error);
  }
  return getLocalLogs();
}
