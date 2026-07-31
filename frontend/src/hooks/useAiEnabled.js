import { useEffect, useState } from "react";
import axios from "axios";

// Whether server-side AI features (Gemini) are configured. Cached at module
// level — one request per page load, shared by all consumers.
let cached = null;
let inflight = null;

const fetchStatus = () => {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = axios
      .get("/api/v1/ai/status")
      .then((r) => {
        cached = Boolean(r.data?.enabled);
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      });
  }
  return inflight;
};

const useAiEnabled = () => {
  const [enabled, setEnabled] = useState(cached ?? false);
  useEffect(() => {
    let mounted = true;
    fetchStatus().then((v) => mounted && setEnabled(v));
    return () => { mounted = false; };
  }, []);
  return enabled;
};

export default useAiEnabled;
