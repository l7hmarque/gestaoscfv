import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  profiles: Record<string, { id: string; nome: string }>;
  mentions: string[];
  onMentionsChange: (ids: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function MentionInput({
  value, onChange, profiles, mentions, onMentionsChange,
  placeholder, rows = 4, className, onKeyDown,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profList = Object.values(profiles).filter(p => p.nome);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);

    // Check if we're typing after @
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setSearch(atMatch[1].toLowerCase());
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const selectProfile = (profileId: string, nome: string) => {
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const start = cursorPos - atMatch[0].length;
      const newVal = value.slice(0, start) + `@${nome} ` + value.slice(cursorPos);
      onChange(newVal);
      if (!mentions.includes(profileId)) {
        onMentionsChange([...mentions, profileId]);
      }
    }
    setShowDropdown(false);
    textareaRef.current?.focus();
  };

  const filtered = profList.filter(p =>
    p.nome.toLowerCase().includes(search)
  ).slice(0, 6);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className={className}
        onKeyDown={(e) => {
          if (showDropdown && e.key === "Escape") {
            setShowDropdown(false);
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 bg-popover border rounded-md shadow-md mt-1 w-full max-h-40 overflow-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              onMouseDown={(e) => { e.preventDefault(); selectProfile(p.id, p.nome); }}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render text with @mentions highlighted */
export function renderMentionText(text: string, profiles: Record<string, any>) {
  const profNames = Object.values(profiles).map((p: any) => p.nome).filter(Boolean);
  if (!profNames.length) return text;

  const pattern = new RegExp(`@(${profNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts: (string | { name: string; id: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const prof = Object.values(profiles).find((p: any) => p.nome === match![1]);
    parts.push({ name: match[1], id: prof?.id || "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}
