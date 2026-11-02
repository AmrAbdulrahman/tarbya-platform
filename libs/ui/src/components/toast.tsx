import { CircleCheck } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

interface Item {
  id: number;
  message: string;
}

let nextId = 0;

/** Short confirmations at the bottom of the screen, read out by screen readers. */
export function ToastProvider({
  children,
  duration = 4000,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const show = useCallback<ShowToast>(
    (message) => {
      const id = ++nextId;
      setItems((all) => [...all, { id, message }]);
      setTimeout(
        () => setItems((all) => all.filter((x) => x.id !== id)),
        duration,
      );
    },
    [duration],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex items-center gap-2 rounded-card bg-navy px-4 py-3 text-[15px] font-medium text-white shadow-lg"
          >
            <CircleCheck className="size-5 text-emerald-300" aria-hidden />
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Shows a toast; needs a `ToastProvider` above. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}
