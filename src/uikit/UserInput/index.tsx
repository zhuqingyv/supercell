import { memo, useState, useEffect, useCallback, useRef } from "react";
import styles from "./UserInput.module.css";

interface UserInputProps {
  modelList: string[];
  currentModel: string;
  value: string;
  onCommit: (value: string) => void;
  onModelChange?: (model: string) => void;
  onChange?: (value: string) => void;
  disabled?: boolean;
  onStop?: () => void;
}

export const UserInput = memo(function UserInput(props: UserInputProps) {
  const { modelList, currentModel, value, onCommit, onModelChange, onChange, disabled = false, onStop } = props;
  const [text, setText] = useState(value);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelDropdownOpen]);

  const displayList = modelList.includes(currentModel)
    ? modelList
    : [currentModel, ...modelList];

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onCommit(trimmed);
    setText("");
    onChange?.("");
    // Reset textarea height after clearing content
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onCommit, onChange, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      handleSubmit();
    },
    [handleSubmit]
  );

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {modelList.length > 0 && (
        <div className={styles.modelBar}>
          {onModelChange ? (
            <>
              <button
                type="button"
                className={styles.modelTrigger}
                onClick={() => setModelDropdownOpen((o) => !o)}
                aria-expanded={modelDropdownOpen}
                aria-haspopup="listbox"
                aria-label="选择模型"
                disabled={disabled}
              >
                <span className={styles.modelLabel}>模型</span>
                <span className={styles.modelValue} title={currentModel}>
                  {currentModel.length > 24 ? `${currentModel.slice(0, 24)}...` : currentModel}
                </span>
                <span className={styles.modelChevron} aria-hidden>
                  {modelDropdownOpen ? '▲' : '▼'}
                </span>
              </button>
              {modelDropdownOpen && (
                <ul
                  className={styles.modelList}
                  role="listbox"
                  aria-label="模型列表"
                >
                  {displayList.map((model) => (
                    <li key={model}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={model === currentModel}
                        className={styles.modelOption}
                        onClick={() => {
                          onModelChange(model);
                          setModelDropdownOpen(false);
                        }}
                      >
                        {model}
                        {model === currentModel && (
                          <span className={styles.modelCurrent}>当前</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <span className={styles.modelLabel}>模型</span>
              <span className={styles.modelValue}>{currentModel}</span>
            </>
          )}
        </div>
      )}
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          style={{ opacity: disabled ? 0.5 : 1 }}
          value={text}
          onChange={(e) => { setText(e.target.value); onChange?.(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI 正在回复..." : "输入消息，Enter 发送，Shift+Enter 换行"}
          rows={1}
          disabled={disabled}
        />
        {disabled ? (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={onStop}
            aria-label="停止生成"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSubmit}
            aria-label="发送"
            disabled={!text.trim()}
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
});
