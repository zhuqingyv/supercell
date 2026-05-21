import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: "2.5rem" }}>⚠️</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 500 }}>出了点问题</div>
          <div style={{ fontSize: "0.85rem", opacity: 0.6, maxWidth: "400px" }}>
            {this.state.error?.message || "未知错误"}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#646cff",
              color: "#fff",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
