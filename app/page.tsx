"use client";

import { useState, useEffect } from "react";
import ChatInterface from "@/components/chat-interface";
import { Sidebar } from "@/components/sidebar";

const REPO_STORAGE_KEY = "cortex_active_repo";
const DOC_STORAGE_KEY = "cortex_active_doc";

export default function Home() {
  const [loadedHistory, setLoadedHistory] = useState<{ id: string; query: string; response: string; mode: string; relevancy: number } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [chatKey, setChatKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Persist ingestedRepo in localStorage so it survives reloads & new chats
  // Only removed when user manually clicks × (dismiss)
  const [ingestedRepo, setIngestedRepo] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(REPO_STORAGE_KEY) ?? null;
    }
    return null;
  });

  const handleSetIngestedRepo = (repoName: string) => {
    setIngestedRepo(repoName);
    localStorage.setItem(REPO_STORAGE_KEY, repoName);
    // Mutual exclusivity
    setActiveDoc(null);
    localStorage.removeItem(DOC_STORAGE_KEY);
  };

  const handleDismissRepo = () => {
    setIngestedRepo(null);
    localStorage.removeItem(REPO_STORAGE_KEY);
  };

  // Persist active uploaded document in localStorage — same pattern as ingestedRepo
  const [activeDoc, setActiveDoc] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(DOC_STORAGE_KEY) ?? null;
    }
    return null;
  });

  const handleSetActiveDoc = (docName: string) => {
    setActiveDoc(docName);
    localStorage.setItem(DOC_STORAGE_KEY, docName);
    // Mutual exclusivity
    setIngestedRepo(null);
    localStorage.removeItem(REPO_STORAGE_KEY);
  };

  const handleDismissDoc = () => {
    setActiveDoc(null);
    localStorage.removeItem(DOC_STORAGE_KEY);
  };

  return (
    <main className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        onSelectHistory={(item) => {
          setLoadedHistory(item);
          setActiveChatId(item.id);
          setChatKey(prev => prev + 1);
        }}
        onDeleteHistory={(id) => {
          setIsResetting(true);
          if (id === activeChatId) {
            setActiveChatId(undefined);
            setChatKey(prev => prev + 1);
          }
        }}
        onRepoIngested={handleSetIngestedRepo}
        onDocIngested={handleSetActiveDoc}
        historyRefreshKey={historyRefreshKey}
        activeId={activeChatId}
      />
      <div className="flex-1 flex flex-col h-full">
        <ChatInterface
          key={chatKey}
          loadedHistory={loadedHistory}
          onHistoryLoaded={() => {
            setLoadedHistory(null);
            setIsResetting(false);
          }}
          onNewChat={() => {
            setActiveChatId(undefined);
            setChatKey(prev => prev + 1);
          }}
          reset={isResetting}
          ingestedRepo={ingestedRepo}
          onDismissRepo={handleDismissRepo}
          activeDoc={activeDoc}
          onDismissDoc={handleDismissDoc}
          onChatComplete={() => setHistoryRefreshKey(k => k + 1)}
        />
      </div>
    </main>
  );
}
