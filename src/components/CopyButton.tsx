// Shared copy affordance (UX-02): a VISIBLE, focusable <button> — never
// hover-gated — that writes a value through the platform clipboard seam and shows
// a momentary "Copied" confirmation (useCopyFeedback). Generalized verbatim from
// the Base64 pane copy button so the four catalogue tools (Unix Time, JWT, Hash,
// UUID/ULID) all share one ≤1-keystroke copy look. Clipboard goes through the
// platform seam ONLY — never @tauri-apps/* directly.
import { Check, Copy } from "lucide-react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";

export interface CopyButtonProps {
  /** The text written to the clipboard on click. */
  value: string;
  /** Human label; the button is aria-label=`Copy ${label}`. */
  label: string;
  /** Optional extra classes appended to the base button styles. */
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, confirmCopy] = useCopyFeedback();

  function handleCopy() {
    void platform.clipboard.writeText(value);
    confirmCopy();
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={[
        "flex cursor-pointer items-center gap-1.5 rounded-[7px] border bg-input-bg px-2 py-1 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
        copied
          ? "border-accent-line text-accent"
          : "border-bd text-tx-2 hover:border-bd-2 hover:text-tx",
        className ?? "",
      ].join(" ")}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
