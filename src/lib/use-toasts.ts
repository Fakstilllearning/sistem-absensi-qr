import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "@/components/ui";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((tone: ToastItem["tone"], message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const success = useCallback((m: string) => push("success", m), [push]);
  const error = useCallback((m: string) => push("error", m), [push]);
  const info = useCallback((m: string) => push("info", m), [push]);
  const warning = useCallback((m: string) => push("warning", m), [push]);

  return { toasts, success, error, info, warning };
}
