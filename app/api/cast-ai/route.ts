import { NextResponse } from 'next/server';
import { fetchOpenRouterCompletion, OpenRouterMessage } from '@/lib/openrouter';

export async function POST(req: Request) {
  try {
    const { messages, transcripts, userName } = await req.json();

    const formattedTranscripts = (transcripts || [])
      .map((t: any) => {
        const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `[${time}] ${t.speaker}: ${t.text}`;
      })
      .join('\n');

    const systemPrompt = `You are CastAI, an intelligent, concise, and helpful in-call AI assistant for Bloom.io video meetings.
You have real-time memory and context awareness of everything spoken in this meeting.
The participant you are assisting is ${userName || 'the user'}.

CURRENT MEETING TRANSCRIPTS IN MEMORY:
${formattedTranscripts && formattedTranscripts.trim().length > 0 ? formattedTranscripts : '(No transcripts recorded yet in this meeting)'}

STRICT GUARDRAILS & POLICIES (MANDATORY):
1. ZERO TOLERANCE for cursing, profanity, bad words, vulgarity, offensive, unethical, or harmful content. Never generate inappropriate, toxic, or unethical statements under any circumstances.
2. Maintain a polite, professional, and respectful tone at all times.
3. NO CORPORATE BUZZWORDS OR JARGON: Do NOT use pretentious buzzwords, marketing hype, or superficial filler words. Speak simply, clearly, and naturally.
4. BE CONCISE AND DIRECT: Do NOT be overly talkative, verbose, or flowery. Get straight to the point with high-value answers.
5. NO ASTERISKS: Do NOT use markdown bold asterisks ("**") or italic asterisks ("*") anywhere in your output. Format lists using clean simple dashes (-) or plain numbers (1., 2.), without bolding words with asterisks.`;

    const fullMessages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(messages || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    let reply = await fetchOpenRouterCompletion(fullMessages);
    if (reply) {
      // Strip any stray markdown asterisks
      reply = reply.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*/g, '$1$2').trim();
    }
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[CastAI API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate CastAI response' },
      { status: 500 }
    );
  }
}
