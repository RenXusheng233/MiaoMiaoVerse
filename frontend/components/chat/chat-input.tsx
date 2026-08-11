"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  disabled: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }

  return (
    <div className="flex items-center gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // skip IME composition confirms (Chinese input method Enter)
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="问问猫咪的事…"
        // py-2.5 keeps the single-line placeholder vertically centered
        // (44px height = 10px + 24px line + 10px)
        className="min-h-11 max-h-32 flex-1 resize-none py-2.5"
        disabled={disabled}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label="发送"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
