'use client';

import { useUser } from '@clerk/nextjs';
import { useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';
import { Copy, Play, Link as LinkIcon, IdentificationBadge } from '@/components/icons';
import { useGetCallById } from '@/hooks/useGetCallById';
import { useToast } from '@/components/ui/use-toast';

const InfoRow = ({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) => (
  <div className="flex flex-col gap-1 py-4 border-b border-black/5 last:border-0">
    <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">{label}</span>
    <span className={`text-sm font-medium truncate ${isLink ? "text-ember-deep" : "text-ink"}`}>{value}</span>
  </div>
);

const PersonalRoom = () => {
  const router = useRouter();
  const { user } = useUser();
  const client = useStreamVideoClient();
  const { toast } = useToast();

  const meetingId = user?.id;
  const { call } = useGetCallById(meetingId!);
  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}?personal=true`;

  const startRoom = async () => {
    if (!client || !user) return;
    const newCall = client.call('default', meetingId!);
    if (!call) {
      await newCall.getOrCreate({ data: { starts_at: new Date().toISOString() } });
    }
    router.push(`/meeting/${meetingId}?personal=true`);
  };

  return (
    <section className="flex flex-col gap-8 pt-12 px-4 md:px-6 lg:px-8 font-geist">
      <div className="flex flex-col gap-1 border-b border-black/5 pb-8">
        <h1 className="font-pixel text-4xl font-normal tracking-[-0.02em] text-ink">Personal room</h1>
        <p className="font-serif text-base text-ink-muted">Your dedicated space for instant collaboration.</p>
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(154,52,18,0.3)]">
        <div className="px-6">
          <InfoRow label="Topic" value={`${user?.username || user?.firstName}'s Personal Room`} />
          <InfoRow label="Room ID" value={meetingId!} />
          <InfoRow label="Invite link" value={meetingLink} isLink />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-black/5 px-6 py-5">
          <button
            onClick={startRoom}
            className="flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-soft"
          >
            <Play size={16} weight="bold" />
            Start meeting
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(meetingLink);
              toast({ title: 'Link copied!' });
            }}
            className="flex items-center gap-2 rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ember/5"
          >
            <Copy size={16} weight="regular" />
            Copy link
          </button>
        </div>
      </div>
    </section>
  );
};

export default PersonalRoom;
