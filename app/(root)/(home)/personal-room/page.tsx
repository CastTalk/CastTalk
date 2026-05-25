'use client';

import { useUser } from '@clerk/nextjs';
import { useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';
import { Copy, Play, Link as LinkIcon, IdentificationBadge } from '@phosphor-icons/react';
import { useGetCallById } from '@/hooks/useGetCallById';
import { useToast } from '@/components/ui/use-toast';

const InfoRow = ({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) => (
  <div className="flex flex-col gap-1 py-4 border-b border-dashed border-[#c4cccc] last:border-0">
    <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">{label}</span>
    <span className={`text-sm font-medium truncate ${isLink ? 'text-slate-600' : 'text-black'}`}>{value}</span>
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
      <div className="flex flex-col gap-1 border-b border-dashed border-[#c4cccc] pb-8">
        <h1 className="text-3xl font-normal tracking-tight text-black">Personal room</h1>
        <p className="text-sm text-slate-500">Your dedicated space for instant collaboration.</p>
      </div>

      <div className="w-full max-w-2xl bg-white border border-[#c4cccc] rounded-none">
        <div className="px-6">
          <InfoRow label="Topic" value={`${user?.username || user?.firstName}'s Personal Room`} />
          <InfoRow label="Room ID" value={meetingId!} />
          <InfoRow label="Invite link" value={meetingLink} isLink />
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-dashed border-[#c4cccc]">
          <button
            onClick={startRoom}
            className="flex items-center gap-2 bg-[#121212] hover:bg-black text-white px-6 py-2.5 text-sm font-medium transition-colors"
          >
            <Play size={16} weight="bold" />
            Start meeting
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(meetingLink);
              toast({ title: 'Link copied!' });
            }}
            className="flex items-center gap-2 border border-[#c4cccc] hover:bg-black/5 text-black px-6 py-2.5 text-sm font-medium transition-colors"
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
