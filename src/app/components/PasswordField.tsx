import { useId, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField } from "./TextField";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with a show/hide control that does not interrupt Tab between fields. */
export function PasswordField({
  className,
  onKeyDown,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const shortcutHintId = useId();
  const describedBy = [ariaDescribedBy, shortcutHintId].filter(Boolean).join(" ");
  const toggleVisibility = () => setVisible((current) => !current);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // With focus in the input, Alt+V offers keyboard access to the show/hide action.
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      toggleVisibility();
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <TextField
        {...rest}
        type={visible ? "text" : "password"}
        className={`pr-12 ${className ?? ""}`}
        aria-describedby={describedBy}
        aria-keyshortcuts="Alt+V"
        onKeyDown={handleKeyDown}
      />
      <span id={shortcutHintId} className="sr-only">
        Pressione Alt+V para mostrar ou ocultar a senha.
      </span>
      <button
        type="button"
        tabIndex={-1}
        onClick={toggleVisibility}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        title={visible ? "Esconder senha (Alt+V)" : "Mostrar senha (Alt+V)"}
        className="absolute inset-y-0 right-1 my-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-sage/60 hover:text-sage-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
