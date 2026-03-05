"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>("");

  const generateNewSession = () => {
    const newId = uuidv4();
    localStorage.setItem("deep-research-session-id", newId);
    setSessionId(newId);
    return newId;
  };

  const setSessionTo = (id: string) => {
    localStorage.setItem("deep-research-session-id", id);
    setSessionId(id);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("deep-research-session-id");
      if (!storedId) {
        storedId = uuidv4();
        localStorage.setItem("deep-research-session-id", storedId);
      }
      setSessionId(storedId);
    }
  }, []);

  return { sessionId, newSession: generateNewSession, setSessionTo };
}
