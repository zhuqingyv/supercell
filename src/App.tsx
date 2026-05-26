import { memo, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { UserInput } from "./uikit/UserInput";
import { ChatSidebar } from "./uikit/ChatSidebar";
import { store } from "./store";
import type { PageKey } from "./store";
import { getService } from "./service";
import { roleModule } from "./service/modules/role";
import type { Message } from "./service/types";
import { Message as MessageUI } from "./uikit/Message";

// 代码分割：延迟加载非首屏模块
const CsvImportPage = lazy(() => import("./features/csv-import"));
const DatalensPage = lazy(() => import("./datalens/QueryPanel"));

export default memo(function App() {
  const { state: currentPage } = store.useSelector((state) => state.currentPage);
  
  // 细化 selector：只订阅需要的字段，减少不必要的重渲染
  const { state: currentChatMessages } = store.useSelector(
    (state) => state.chatList.find((c) => c.id === state.currentChatId)?.messages ?? []
  );
  const { state: currentChatId } = store.useSelector((state) => state.currentChatId);
  const { state: currentModel } = store.useSelector((state) => state.currentModel);
  const { state: modelList } = store.useSelector((state) => state.modelList);
  const { state: isLoading } = store.useSelector((state) => state.isLoading);
  const { state: currentChatInputCache } = store.useSelector(
    (state) => state.chatList.find((c) => c.id === state.currentChatId)?.userInputCache ?? ""
  );
  
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<FixedSizeList>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef<string>("");
  const lastMsgContent = currentChatMessages[currentChatMessages.length - 1]?.content ?? "";

  const userScrolledUpRef = useRef(false);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 100;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  }, [currentChatMessages.length]);

  useEffect(() => {
    if (!isLoading) return;
    requestAnimationFrame(() => {
      if (!userScrolledUpRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    });
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
        if (streamIdRef.current === streamId) setLoading(false);
      }
    }
  );

  const handleInputChange = useCallback((value: string) => {
    if (currentChatId) setUserInputCache({ id: currentChatId, cache: value });
  }, [currentChatId, setUserInputCache]);

  const handleCommit = useCallback((value: string) => {
    if (isLoading) return;
    const messageItem: Message = { id: crypto.randomUUID(), role: "user", content: value };
    commitChat({ message: messageItem, id: currentChatId ?? "default" });
  }, [isLoading, commitChat, currentChatId]);

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

  // Message row component for virtual list - 使用 memo 避免不必要的重渲染
  const MessageRow = useMemo(() => {
    return memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
      const message = currentChatMessages[index];
      if (!message) return null;
      const isLastAssistant = isLoading && index === currentChatMessages.length - 1 && message.role === "assistant";
      return (
        <div style={style} className="px-2">
          <MessageUI
            key={message.id}
            direction={message.role === "user" ? "right" : "left"}
            content={message.content}
            isLoading={isLastAssistant && message.content === ""}
            isStreaming={isLastAssistant && message.content !== ""}
          />
        </div>
      );
    });
  }, [currentChatMessages, isLoading]);
  MessageRow.displayName = "MessageRow";

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
          <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}>
            <CsvImportPage />
          </Suspense>
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
              ) : currentChatMessages.length > 20 ? (
                <div ref={listContainerRef} className="h-full w-full">
                  <AutoSizer>
                    {({ height, width }) => (
                      <FixedSizeList
                        ref={scrollListRef}
                        count={currentChatMessages.length}
                        height={height}
                        width={width}
                        itemSize={200}
                        itemData={currentChatMessages}
                      >
                        {MessageRow}
                      </FixedSizeList>
                    )}
                  </AutoSizer>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {currentChatMessages.map((message, index) => {
                    const isLastAssistant =
                      isLoading &&
                      index === currentChatMessages.length - 1 &&
                      message.role === "assistant" &&
                      message.content !== ""
                    return (
                      <div key={message.id} className="px-2">
                        <MessageUI
                          direction={message.role === "user" ? "right" : "left"}
                          content={message.content}
                          isLoading={isLastAssistant && message.content === ""}
                          isStreaming={isLastAssistant && message.content !== ""}
                        />
                      </div>
                    );
                  })}
                </div>
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
                value={currentChatInputCache}
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
