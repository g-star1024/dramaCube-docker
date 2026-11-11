'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SearchBar({
  defaultValue = '',
  placeholder = '搜索影视、演员、导演…',
  onSubmit,
}: {
  defaultValue?: string;
  placeholder?: string;
  onSubmit?: (word: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = q.trim();
    if (!word) return;
    if (onSubmit) onSubmit(word);
    else router.push(`/search?q=${encodeURIComponent(word)}`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center gap-2 bg-bg-soft border border-line rounded-xl px-4 py-2.5 focus-within:border-accent transition-colors">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-dim"
        />
        <button type="submit" className="btn btn-accent px-3 py-1.5">
          搜索
        </button>
      </div>
    </form>
  );
}
