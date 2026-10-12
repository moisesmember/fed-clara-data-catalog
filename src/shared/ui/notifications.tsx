import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type NotificationTone = "success" | "danger" | "info";

interface Notification {
  id: number;
  tone: NotificationTone;
  message: ReactNode;
}

interface Notifier {
  notify(tone: NotificationTone, message: ReactNode): void;
}

const NotificationsContext = createContext<Notifier | null>(null);

/** Avisos efêmeros anunciados por leitores de tela (aria-live). */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const notify = useCallback(
    (tone: NotificationTone, message: ReactNode) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "danger" ? 9000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="ui-toasts" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`ui-toast ui-toast--${item.tone}`} role={item.tone === "danger" ? "alert" : "status"}>
            <div>{item.message}</div>
            <button type="button" className="ui-toast__close" aria-label="Fechar aviso" onClick={() => dismiss(item.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotify(): Notifier["notify"] {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotify deve ser usado dentro de <NotificationsProvider>");
  }
  return context.notify;
}
