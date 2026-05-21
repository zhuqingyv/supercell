import { memo, useCallback, useEffect, useRef } from "react";
import { UserInput } from "./uikit/UserInput";
import { ChatSidebar } from "./uikit/ChatSidebar";
import { store } from "./store";
import type { PageKey } from "./store";
import { getService } from "./service";
import { roleModule } from "./service/modules/role";
import type { Message } from "./service/types";
import { Message as MessageUI } from "./uikit/Message";
import { CsvImportPage } from "./features/csv-import";

export default memo(function App() {
  const { state: currentPage } = store.useSelector((state) => state.currentPage);
  const { state: currentChat } = store.useSelector((state) =>
    state.chatList.find((chat) => chat.id === state.currentChatId)
  );
  const { state: currentModel } = store.useSelector((state) => state.currentModel);
  const { state: modelList } = store.useSelector((state) => state.modelList);
  const { state: isLoading } = store.useSelector((state) => state.isLoading);
  const {
    commitChat,
    updateModelList,
    setCurrentModel,
    setLoading,
    appendToLastAssistantMessage,
    removeAssistantMessageById,
    renameChatTitle,
    setUserInputCache,
    setCurrentPage,
  } = store.useActions();

  const handlePageChange = useCallback((page: PageKey) => {
    setCurrentPage({ page });
  }, [setCurrentPage]);
  const { messages: currentChatMessages = [] } = currentChat || {};
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Unique ID of the currently active stream — guards setLoading(false) from racing */
  const streamIdRef = useRef<string>("");
  const lastMsgContent = currentChatMessages[currentChatMessages.length - 1]?.content ?? "";

  // Abort any in-flight stream on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Scroll on new message
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  }, [currentChatMessages.length]);

  // Follow cursor during streaming
  useEffect(() => {
    if (!isLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [isLoading, lastMsgContent]);

  store.useSelectorWatch(
    (state) => {
      const chat = state.chatList.find((c) => c.id === state.currentChatId);
      const messages = chat?.messages ?? [];
      const userMessageCount = messages.filter((m) => m.role === "user").length;
      return { chatId: state.currentChatId, userMessageCount, model: state.currentModel };
    },
    async (next, prev) => {
      if (!next || next.userMessageCount === 0) return;
      if (!prev || next.chatId !== prev.chatId) return;
      if (next.userMessageCount === prev.userMessageCount) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const streamId = crypto.randomUUID();
      streamIdRef.current = streamId;

      const state = store.getState();
      const chat = state.chatList.find((c) => c.id === next.chatId);
      if (!chat) return;

      const { messages } = chat;

      setLoading(true);
      const assistantMessageId = crypto.randomUUID();
      store.setState((s) => {
        const c = s.chatList.find((x) => x.id === next.chatId);
        if (c) c.messages.push({ id: assistantMessageId, role: "assistant", content: "" });
      });

      try {
        const service = getService(next.model);
        const stream = await service.chat.completions.create(
          {
            model: next.model,
            messages: [
              {
                role: "system",
                content: roleModule.prompt({ messages, environment: state.environment, userInfo: state.userInfo }),
              },
              ...messages.map(({ role, content }) => ({ role, content })),
            ],
            stream: true,
          },
          { signal: controller.signal }
        );

        let fullContent = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            appendToLastAssistantMessage({ id: next.chatId, content: delta });
          }
        }

        try {
          const json = JSON.parse(fullContent);
          if (json.memory) roleModule.updateMemory(json.memory);
          if (json.main) {
            store.setState((s) => {
              const c = s.chatList.find((x) => x.id === next.chatId);
              if (c && c.messages.length > 0) {
                const last = c.messages[c.messages.length - 1];
                if (last?.role === "assistant") last.content = json.main;
              }
            });
          }
        } catch {
          // not JSON, normal text
        }

        const updatedState = store.getState();
        const updatedChat = updatedState.chatList.find((c) => c.id === next.chatId);
        if (updatedChat && updatedChat.title === "新对话") {
          const firstUser = updatedChat.messages.find((m) => m.role === "user");
          if (firstUser) {
            const title = firstUser.content.slice(0, 20) + (firstUser.content.length > 20 ? "…" : "");
            renameChatTitle({ id: next.chatId, title });
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          removeAssistantMessageById({ id: next.chatId, messageId: assistantMessageId });
          return;
        }
        console.error("Chat completion error:", err);
        removeAssistantMessageById({ id: next.chatId, messageId: assistantMessageId });
        store.setState((s) => {
          const c = s.chatList.find((x) => x.id === next.chatId);
          if (c) c.messages.push({ id: crypto.randomUUID(), role: "assistant", content: "⚠️ 请求失败，请检查网络或模型配置。" });
        });
      } finally {
        // Only clear loading if this stream is still the active one
        if (streamIdRef.current === streamId) setLoading(false);
      }
    }
  );

  const handleInputChange = useCallback((value: string) => {
    if (currentChat?.id) setUserInputCache({ id: currentChat.id, cache: value });
  }, [currentChat?.id, setUserInputCache]);

  const handleCommit = useCallback((value: string) => {
    if (isLoading) return;
    const messageItem: Message = { id: crypto.randomUUID(), role: "user", content: value };
    commitChat({ message: messageItem, id: currentChat?.id ?? "default" });
  }, [isLoading, commitChat, currentChat?.id]);

  const handleModelChange = useCallback((model: string) => {
    setCurrentModel({ model });
  }, [setCurrentModel]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, [setLoading]);

  useEffect(() => {
    updateModelList();
  }, [updateModelList]);

  const NAV_ITEMS: { key: PageKey; label: string }[] = [
    { key: "chat", label: "Chat" },
    { key: "datalens", label: "DataLens" },
  ];

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Navigation */}
      <nav className="flex items-center gap-1 px-4 py-1.5 border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary, #fff)" }}>
        <span className="text-sm font-semibold mr-4" style={{ color: "var(--text-primary)", opacity: 0.7 }}>Supercell</span>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handlePageChange(item.key)}
            className="px-3 py-1 text-sm rounded cursor-pointer"
            style={{
              background: currentPage === item.key ? "var(--accent-soft, rgba(22,119,255,0.1))" : "transparent",
              color: currentPage === item.key ? "var(--accent, #1677ff)" : "var(--text-secondary)",
              fontWeight: currentPage === item.key ? 600 : 400,
              border: "none",
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Page Content */}
      {currentPage === "datalens" ? (
        <div className="flex-1 overflow-y-auto">
          <CsvImportPage />
        </div>
      ) : (
        <div className="flex flex-row flex-1 min-h-0">
          <ChatSidebar />
          <div className="flex flex-col flex-1 h-full min-w-0 py-[12px] sm:pl-0 pl-[48px]">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8" aria-label="对话内容" role="log" aria-live="polite">
              {currentChatMessages.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center select-none">
                  <div className="mb-4" style={{ opacity: 0.35 }}>
                    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
                      <circle cx="26" cy="26" r="24" stroke="var(--accent)" strokeWidth="2" strokeOpacity="0.6"/>
                      <path d="M26 10l2.8 8.6L38 22l-9.2 4.4L26 35l-2.8-8.6L14 22l9.2-4.4L26 10z" fill="var(--accent)" fillOpacity="0.8"/>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)", opacity: 0.6 }}>开始新对话</div>
                  <div className="text-sm mb-7" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>输入消息，按 Enter 发送</div>
                  <div className="flex flex-col gap-2.5 w-full max-w-sm">
                    {["帮我写一段 Python 冒泡排序", "解释一下什么是 RAG", "给这段代码做 code review"].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleCommit(prompt)}
                        className="prompt-suggestion text-sm text-left px-4 py-2.5 rounded-lg cursor-pointer"
                        style={{
                          border: "1px solid var(--border-subtle)",
                          borderLeft: "3px solid var(--accent-soft)",
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                currentChatMessages.map((message, index) => (
                  <MessageUI
                    key={message.id ?? index}
                    direction={message.role === "user" ? "right" : "left"}
                    content={message.content}
                    isLoading={
                      isLoading &&
                      index === currentChatMessages.length - 1 &&
                      message.role === "assistant" &&
                      message.content === ""
                    }
                    isStreaming={
                      isLoading &&
                      index === currentChatMessages.length - 1 &&
                      message.role === "assistant" &&
                      message.content !== ""
                    }
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="w-full px-4 sm:px-6 md:px-8 pt-3">
              <UserInput
                modelList={modelList}
                currentModel={currentModel}
                onCommit={handleCommit}
                onModelChange={handleModelChange}
                onChange={handleInputChange}
                value={currentChat?.userInputCache || ""}
                disabled={isLoading}
                onStop={handleStop}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
