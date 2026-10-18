import { useState, useEffect, useCallback } from 'react';

export type DashboardPersonnel = {
  id: string;
  name: string;
  personnelCode: string;
  designation: string;
  unit: string;
  dutyStatus: "ON DUTY" | "OFF DUTY";
  locationStatus: "TRACKING ACTIVE" | "LOCATION UNAVAILABLE" | "STALE" | "NO DATA";
  deviceStatus: "ONLINE" | "STALE" | "OFFLINE";
  networkStatus: "ONLINE" | "OFFLINE" | "UNKNOWN";
  sosStatus: "SOS ACTIVE" | "NONE";
  lastSeen: string | null;
  lastHeartbeat: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    recordedAt: string;
  } | null;
  device: {
    identifier: string;
    batteryLevel: number | null;
  } | null;
  activeSOSId: string | null;
  activeAlertId: string | null;
};

export function useDashboardData(intervalMs: number = 5000) {
  const [data, setData] = useState<DashboardPersonnel[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (abortController?: AbortController) => {
    try {
      const res = await fetch("/api/control-room/overview", {
        signal: abortController?.signal
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
         setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const controller = new AbortController();

    const loop = async () => {
      // Pause if tab is hidden
      if (document.visibilityState === 'visible') {
        await fetchData(controller);
      }
      if (!controller.signal.aborted) {
        timeoutId = setTimeout(loop, intervalMs);
      }
    };

    loop();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData, intervalMs]);

  return { data, error, isLoading, lastUpdated };
}
