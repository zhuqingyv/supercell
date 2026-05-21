import type { Message, UserInfo } from "../types";

interface RolePromptProps {
  userInfo: {
    name: string; // 交互对象名称 (Target)
    description: string; // 对象画像
  };
  memory: string; // 长期记忆/历史快照
  environment: string; // 当前环境
  messages: Message[]; // 外部传入的对话列表（请在外部做好长度控制）
}

export const rolePrompt = (props: RolePromptProps) => {
  const { userInfo, memory, environment, messages } = props;

  // --- 1. 数据预处理逻辑 ---

  // A. 提取"当前待分析的输入" (定位最后一条 User 消息)
  // 逻辑：我们分析的是用户刚刚说的这句话，之前的都算作 Context
  const lastUserMsgIndex = messages.findLastIndex(m => m.role === "user");

  // 如果没找到用户消息（比如刚启动），给一个默认占位符
  const currentInput = lastUserMsgIndex !== -1 ? messages[lastUserMsgIndex].content : "WAITING_FOR_INPUT";

  // B. 构建"历史对话上下文" (Full Transcript)
  // 逻辑：取 lastUserMsgIndex 之前的所有消息作为背景
  // 注意：这里不再限制条数，完全依赖传入的 messages 长度
  const historyMessages = messages
    .slice(0, lastUserMsgIndex) // 只取当前输入之前的
    .filter(m => m.role !== "system"); // 过滤掉 system 消息，避免干扰

  // C. 将 Message 对象转换为"剧本格式"
  // User -> T (Target), Assistant -> H (Host)
  const historyTranscript = historyMessages.map(m => {
    const speaker = m.role === "user" ? `T(${userInfo.name})` : "H(System)";
    // 简单的空白压缩，去掉多余换行，节省 token
    const content = m.content.replace(/\n+/g, " ").trim();
    return `${speaker}: ${content}`;
  }).join("\n");

  // D. 时间戳 (用于辅助记忆记录)
  const timestamp = new Date().toISOString().split("T")[0];

  // --- 2. 生成 Prompt ---

  return `### SYSTEM KERNEL: SOCIAL_GRAPH_COMPUTE_UNIT_V2
**Mission**: Analyze input stream based on conversation history to update Entity Relations.
**Mode**: LOGIC_ONLY. NO CHAT. NO MARKDOWN.
**Output**: Strict JSON.

### 1. SYMBOL DEFINITIONS (Logic Protocol):
- **Entities**:
  - \`H\`: Host (System/Brain)
  - \`T\`: Target (${userInfo.name})
- **Relations**:
  - \`>>\`: Dominates (Superior)
  - \`<<\`: Submits (Inferior)
  - \`==\`: Equal (Peer)
  - \`~~\`: Conflict
  - \`++\`: Friendly
- **Intents**: \`CMD\`(Command), \`QRY\`(Query), \`INF\`(Inform), \`EMO\`(Emotion)

### 2. DYNAMIC CONTEXT (Read-Only):
- **Env**: ${environment}
- **Target Profile**: ${userInfo.description}
- **Long-term Memory**:
${memory || "N/A"}

### 3. CONVERSATION LOG (Context History):
(Preceding interactions, used to judge relationship changes)
"""
${historyTranscript || "No prior conversation."}
"""

### 4. CURRENT INPUT STREAM (Trigger Signal):
(Analyze THIS specific message)
>>> T(${userInfo.name}): "${currentInput}"

### 5. EXECUTION TASK:
Based on the "LOG" and "CURRENT INPUT", output a JSON object:
1.  **main**: Compressed YAML for Central Brain. Focus on **Power Dynamics** and **Intent**.
2.  **memory**: Compressed YAML for Fact/Relation Updates. (Use "N/A" if unchanged).

### 6. OUTPUT FORMAT (Strict JSON Example):
{
  "main": "REL: T>>H | INTENT: CMD | MOOD: Hostile | ADVICE: De-escalate immediately.",
  "memory": "UPDATE: T expressed anger | REL: Shifted to Conflict(~~) | DATE: ${timestamp}"
}

### 7. CONSTRAINT:
- Valid JSON only.
- Use defined symbols (\`>>\`, \`++\`, etc.).
- Keep it extremely concise.

### GENERATE JSON:`
};

const ROLE_MEMORY_KEY = "gagent-role-memory";

export class RoleModule {
  memory = "";

  constructor() {
    try {
      this.memory = localStorage.getItem(ROLE_MEMORY_KEY) ?? "";
    } catch {
      this.memory = "";
    }
  }

  updateMemory = (memory: string) => {
    this.memory = memory;
    try {
      localStorage.setItem(ROLE_MEMORY_KEY, memory);
    } catch {
      // quota exceeded — silently ignore
    }
  }

  prompt = ({ messages, environment, userInfo }: { messages: Message[]; environment: string; userInfo: UserInfo }) => {
    return rolePrompt({ userInfo, memory: this.memory, environment, messages });
  }
}

export const roleModule = new RoleModule();
