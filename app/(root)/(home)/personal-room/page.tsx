"use client";

import { useUser } from "@clerk/nextjs";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Play } from "lucide-react";

import { useGetCallById } from "@/hooks/useGetCallById";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const Table = ({
  title,
  description,
  isLink = false,
}: {
  title: string;
  description: string;
  isLink?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-4 border border-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
      <h1 className="text-sm font-medium text-sky-1 opacity-80 uppercase tracking-wider">
        {title}
      </h1>
      <h1
        className={cn(
          "truncate text-base font-semibold max-sm:max-w-[320px] lg:text-lg",
          isLink ? "text-blue-400" : "text-white"
        )}
      >
        {description}
      </h1>
    </div>
  );
};

const PersonalRoom = () => {
  const router = useRouter();
  const { user } = useUser();
  const client = useStreamVideoClient();
  const { toast } = useToast();

  const meetingId = user?.id;

  const { call } = useGetCallById(meetingId!);

  const startRoom = async () => {
    if (!client || !user) return;

    const newCall = client.call("default", meetingId!);

    if (!call) {
      await newCall.getOrCreate({
        data: {
          starts_at: new Date().toISOString(),
        },
      });
    }

    router.push(`/meeting/${meetingId}?personal=true`);
  };

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}?personal=true`;

  return (
    <section className="flex size-full flex-col gap-8 text-white">
      <div className="flex items-center gap-4">
        <div className="flex-center size-14 rounded-[16px] bg-blue-1/10 border border-blue-1/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <Image src="/icons/add-meeting.svg" alt="calendar" width={28} height={28} className="opacity-90 contrast-[0.9] brightness-[1.1]" style={{ filter: 'invert(100%) brightness(0.5) sepia(1) hue-rotate(180deg) saturate(5)'}} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-dark-1 to-dark-3">
            Personal Meeting Room
        </h1>
      </div>

      <div className="flex w-full flex-col gap-6 rounded-[24px] bg-dark-1/40 p-8 border border-white/10 backdrop-blur-lg shadow-2xl xl:max-w-[900px]">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Table title="Topic" description={`${user?.username}'s Meeting Room`} />
            <Table title="Meeting ID" description={meetingId!} />
        </div>
        
        <Table title="Invite Link" description={meetingLink} isLink />

        <div className="flex flex-wrap gap-4 mt-4">
          <Button 
            className="rounded-[12px] bg-blue-1 px-8 py-6 font-semibold hover:bg-blue-1/90 transition-all shadow-lg hover:shadow-blue-1/20" 
            onClick={startRoom}
          >
            <Play className="mr-2 size-5 fill-current" />
            Start Meeting
          </Button>
          <Button
            className="rounded-[12px] bg-dark-3 px-8 py-6 font-semibold border border-white/10 hover:bg-dark-4 transition-all shadow-md"
            onClick={() => {
              navigator.clipboard.writeText(meetingLink);
              toast({
                title: "Link Copied",
              });
            }}
          >
            <Copy className="mr-2 size-5" />
            Copy Invitation
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PersonalRoom;
