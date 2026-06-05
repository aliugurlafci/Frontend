"use client";

import { useState } from "react";

/** A small, dependency-free curated emoji set for the chat composer. */
const EMOJIS =
  "😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🤔 🙂 🙃 😉 😇 🥳 😴 😅 😢 😭 😤 😡 🥺 😬 🤗 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 🤞 👌 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ ⭐ 🎉 🎊 ✅ ❌ ⚠️ ❓ ❗ 💡 📌 📎 📁 📄 📷 💬 📞 📅 ⏰ 🚀 💰 📈 📉 🏆 🎯".split(
    " ",
  );

/** Emoji button + popover; calls `onPick` with the chosen emoji. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add emoji"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <span className="text-lg leading-none">🙂</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="glass-strong absolute bottom-11 left-0 z-50 grid w-72 grid-cols-8 gap-1 rounded-xl border border-border p-2 shadow-[var(--shadow-lg)]">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-surface-2"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
