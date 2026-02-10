"use client";

import { useState } from "react";
import ChatInterface from "@/components/chat-interface";
import { Sidebar } from "@/components/sidebar";

export default function Home() {
  const [loadedHistory, setLoadedHistory] = useState<{ id: string; query: string; response: string; mode: string; relevancy: number } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [chatKey, setChatKey] = useState(0);

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
        />
      </div>
    </main>
  );
}
