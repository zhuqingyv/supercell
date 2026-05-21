import { createLocalStore } from "../createStore";
import type { Message, UserInfo } from "../service/types";

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  userInputCache?: string;
};

let updateModelListRequestId = 0;
const MODEL_LIST_TIMEOUT_MS = 10_000;

export type PageKey = "chat" | "datalens";

export const store = createLocalStore("supercell-v1", {
  currentPage: "chat" as PageKey,
  chatList: [{ id: "default", title: "新对话", messages: [] }] as Chat[],
  currentChatId: "default" as string,
  currentModel: "qwen2.5-7b-instruct-1m",
  modelList: ["qwen2.5-7b-instruct-1m"],
  environment: "",
  userInfo: { name: "user", description: "user" } as UserInfo,
  isLoading: false,
}, ({ setState, getState }) => ({
  commitChat: ({ message, id }: { message: Message; id: string }) => {
    setState((state) => {
      let chat = state.chatList.find((c) => c.id === id);
      if (!chat) {
        chat = state.chatList.find((c) => c.id === state.currentChatId);
      }
      if (!chat) {
        chat = state.chatList.find((c) => c.id === "default");
        if (!chat) {
          chat = { id: "default", title: "新对话", messages: [] };
          state.chatList.push(chat);
        }
        state.currentChatId = chat.id;
      }
      chat.messages.push({ ...message, id: message.id ?? crypto.randomUUID() });
    });
  },
  appendToLastAssistantMessage: ({ id, content }: { id: string; content: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (chat && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg?.role === "assistant") {
          lastMsg.content += content;
        }
      }
    });
  },
  removeLastEmptyAssistantMessage: ({ id }: { id: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (chat && chat.messages.length > 0) {
        const last = chat.messages[chat.messages.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          chat.messages.pop();
        }
      }
    });
  },
  removeAssistantMessageById: ({ id, messageId }: { id: string; messageId: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (!chat) return;
      const idx = chat.messages.findIndex(
        (m) => m.id === messageId && m.role === "assistant" && m.content === ""
      );
      if (idx !== -1) {
        chat.messages.splice(idx, 1);
      }
    });
  },
  setLoading: (loading: boolean) => {
    setState((state) => {
      state.isLoading = loading;
    });
  },
  addChat: () => {
    const id = `chat-${crypto.randomUUID()}`;
    setState((state) => {
      state.chatList.push({ id, title: "新对话", messages: [] });
      state.currentChatId = id;
    });
  },
  deleteChat: ({ id }: { id: string }) => {
    setState((state) => {
      const idx = state.chatList.findIndex((c) => c.id === id);
      if (idx === -1) return;
      state.chatList.splice(idx, 1);
      if (state.chatList.length === 0) {
        state.chatList.push({ id: "default", title: "新对话", messages: [] });
      }
      if (state.currentChatId === id) {
        state.currentChatId = state.chatList[0].id;
      }
    });
  },
  setCurrentChatId: ({ id }: { id: string }) => {
    setState((state) => {
      if (!state.chatList.some((chat) => chat.id === id)) return;
      state.currentChatId = id;
    });
  },
  renameChatTitle: ({ id, title }: { id: string; title: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (chat) chat.title = title;
    });
  },
  clearChat: ({ id }: { id: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (chat) chat.messages = [];
    });
  },
  setUserInputCache: ({ id, cache }: { id: string; cache: string }) => {
    setState((state) => {
      const chat = state.chatList.find((c) => c.id === id);
      if (chat) chat.userInputCache = cache;
    });
  },
  setCurrentModel: ({ model }: { model: string }) => {
    setState((state) => {
      state.currentModel = model;
    });
  },
  updateModelList: async () => {
    const requestId = ++updateModelListRequestId;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS);
    try {
      const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL?.trim();
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();
      if (!baseUrl || !apiKey) {
        throw new Error("Missing VITE_OPENAI_BASE_URL or VITE_OPENAI_API_KEY");
      }

      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      const nextModels: string[] = Array.from(
        new Set(
          data
            .map((item: Record<string, unknown>) =>
              typeof item?.id === "string" ? item.id.trim() : ""
            )
            .filter((id: string) => id.length > 0)
        )
      );
      if (requestId !== updateModelListRequestId || nextModels.length === 0) return;
      setState((state) => {
        if (requestId !== updateModelListRequestId) return;
        state.modelList = nextModels;
        if (!nextModels.includes(state.currentModel)) {
          state.currentModel = nextModels[0];
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`Failed to fetch model list: request timed out after ${MODEL_LIST_TIMEOUT_MS}ms`);
      } else {
        console.warn("Failed to fetch model list:", err);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
  setCurrentPage: ({ page }: { page: PageKey }) => {
    setState((state) => {
      state.currentPage = page;
    });
  },
  getAllMessages: () => {
    const state = getState();
    const { currentChatId, chatList } = state;
    const currentChat = chatList.find((chat) => chat.id === currentChatId);
    if (!currentChat) return [];
    return currentChat.messages;
  },
}));
