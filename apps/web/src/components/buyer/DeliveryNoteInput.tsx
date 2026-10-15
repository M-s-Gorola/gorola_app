import { FileText } from "lucide-react";
import { type ChangeEvent, type ReactElement } from "react";

export interface DeliveryNoteInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  maxLength?: number;
}

export function DeliveryNoteInput({
  value,
  onChange,
  label = "Delivery Note / Instructions for Rider",
  placeholder = "e.g. Leave with security guard, gate code #123, call before arrival",
  id = "delivery-instructions-input",
  className = "",
  maxLength = 500
}: DeliveryNoteInputProps): ReactElement {
  const currentLength = (value ?? "").length;

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (value && value !== value.trim()) {
      onChange(value.trim());
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 font-dm-sans text-xs font-semibold text-gorola-charcoal"
        >
          <FileText className="h-3.5 w-3.5 text-gorola-pine/70 shrink-0" />
          <span>{label}</span>
        </label>
        <span
          data-testid="delivery-note-counter"
          className="font-dm-sans text-[11px] text-gorola-slate/70"
        >
          {currentLength} / {maxLength} characters
        </span>
      </div>
      <textarea
        id={id}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-xl border border-gorola-pine/15 bg-gorola-fog/30 px-3.5 py-2.5 font-dm-sans text-xs text-gorola-charcoal placeholder:text-gorola-slate/50 outline-none transition-all focus:border-gorola-pine/40 focus:bg-white focus:ring-1 focus:ring-gorola-pine/30 resize-none"
      />
    </div>
  );
}
