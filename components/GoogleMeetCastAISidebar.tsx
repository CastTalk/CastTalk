'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkle, 
  PaperPlaneRight, 
  Copy, 
  Check, 
  ClosedCaptioning
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { TranscriptItem } from './GoogleMeetTranscriptsSidebar';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const cleanText = (text: string) => {
  return text.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*/g, '$1$2');
};

interface GoogleMeetCastAISidebarProps {
  onClose: () => void;
  transcripts: TranscriptItem[];
  userName?: string;
  onOpenTranscripts?: () => void;
}

export const GoogleMeetCastAISidebar: React.FC<GoogleMeetCastAISidebarProps> = ({
  onClose,
  transcripts,
  userName = 'You',
  onOpenTranscripts,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/cast-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          transcripts: transcripts,
          userName: userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get answer from CastAI');
      }

      const cleanedReply = cleanText(data.reply || 'No response received.').trim();

      const aiMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: cleanedReply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to reach CastAI service.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const quickPrompts = [
    '✨ Summarize the meeting so far',
    '📋 What are the key action items?',
    '🔍 Who spoke and what was discussed?',
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#202124] text-white rounded-2xl border border-[#3c4043] shadow-2xl overflow-hidden font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#3c4043]/60 bg-[#202124] shrink-0">
        <h2 className="text-lg font-medium tracking-tight text-white">CastAI</h2>
        <button 
          onClick={onClose}
          className="p-1.5 -mr-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Close CastAI"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Memory context badge bar */}
      <div className="px-4 py-2 bg-[#1b1c1e] border-b border-[#3c4043]/40 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
          <span className="truncate">
            {transcripts.length > 0
              ? `${transcripts.length} transcript segments in memory`
              : 'No transcripts recorded yet'}
          </span>
        </div>
        {onOpenTranscripts && (
          <button
            onClick={onOpenTranscripts}
            className="text-[#8ab4f8] hover:underline text-[11px] font-medium flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <ClosedCaptioning size={13} weight="bold" />
            <span>View Transcripts</span>
          </button>
        )}
      </div>

      {/* Message Chat Stream Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-0"
      >
        {messages.length === 0 ? (
          /* Empty State with Suggestions */
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="size-12 rounded-2xl bg-[#8ab4f8]/10 text-[#8ab4f8] flex items-center justify-center mb-3 shadow-inner border border-[#8ab4f8]/20">
              <Sparkle size={24} weight="fill" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1.5">
              Ask CastAI about this meeting
            </h3>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mb-6">
              I have real-time memory of everything spoken and transcribed in this call.
            </p>

            <div className="w-full space-y-2">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider text-left mb-1.5 px-1">
                Suggested questions:
              </div>
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#2a2b2e] hover:bg-[#34363a] border border-[#3c4043]/60 text-xs text-slate-200 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate">{prompt}</span>
                  <PaperPlaneRight size={13} className="text-slate-400 group-hover:text-[#8ab4f8] transition-colors shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          messages.map((m) => (
            <div 
              key={m.id} 
              className={cn(
                "flex flex-col max-w-[88%] min-w-0",
                m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div 
                className={cn(
                  "p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed break-words overflow-hidden shadow-md select-text",
                  m.role === 'user' 
                    ? "bg-[#1a73e8] text-white rounded-br-sm" 
                    : "bg-[#2d2f34] text-slate-100 rounded-bl-sm border border-white/5"
                )}
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {cleanText(m.content)}
              </div>

              {/* Message sub-actions */}
              <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(m.id, m.content)}
                    className="hover:text-white transition-colors cursor-pointer ml-1"
                    title="Copy answer"
                  >
                    {copiedId === m.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator: 3 bouncing dots */}
        {loading && (
          <div className="flex items-start mr-auto max-w-[85%]">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[#2d2f34] border border-white/5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#1e1f21] border-t border-[#3c4043]/60 shrink-0">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-[#2d2f34] border border-[#5f6368]/60 focus-within:border-[#8ab4f8] rounded-xl px-3 py-1.5 transition-colors"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask CastAI about the meeting..."
            disabled={loading}
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 outline-none disabled:opacity-50 select-text"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="size-7 rounded-lg bg-[#1a73e8] hover:bg-[#1b66c9] disabled:opacity-40 disabled:hover:bg-[#1a73e8] text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Send query"
          >
            <PaperPlaneRight size={14} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleMeetCastAISidebar;
