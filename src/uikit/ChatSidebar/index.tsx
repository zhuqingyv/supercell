import { memo, useState } from "react";
import { store } from "../../store";
import styles from "./ChatSidebar.module.css";

export const ChatSidebar = memo(function ChatSidebar() {
  const { state: chatList } = store.useSelector((s) => s.chatList);
  const { state: currentChatId } = store.useSelector((s) => s.currentChatId);
  const { state: isLoading } = store.useSelector((s) => s.isLoading);
  const { addChat, deleteChat, setCurrentChatId } = store.useActions();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`删除「${title}」对话？此操作不可撤销。`)) return;
    deleteChat({ id });
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId({ id });
    setMobileOpen(false);
  };

  return (
    <>
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="切换侧栏"
      >
        ☰
      </button>
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ""}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.8 3.6L14 5.5l-3 2.9.7 4.1L8 10.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9L8 1z" fill="white"/>
            </svg>
          </div>
          <span className={styles.brandName}>Supercell</span>
        </div>
        <div className={styles.header}>
          <button
            className={styles.newChatBtn}
            onClick={() => { addChat(); setMobileOpen(false); }}
            disabled={isLoading}
            title="新建对话"
          >
            <span>＋</span>
            <span>新对话</span>
          </button>
        </div>
        <ul className={styles.chatList}>
          {chatList.map((chat) => (
            <li
              key={chat.id}
              className={`${styles.chatItem} ${chat.id === currentChatId ? styles.active : ""}`}
            >
              <button
                className={styles.chatTitle}
                onClick={() => handleSelectChat(chat.id)}
                title={chat.title}
              >
                <span className={styles.titleText}>{chat.title}</span>
              </button>
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(chat.id, chat.title, e)}
                title="删除对话"
                aria-label={`删除「${chat.title}」`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
});
