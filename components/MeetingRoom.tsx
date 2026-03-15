'use client';
import { useState } from 'react';
import {
  CallControls,
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LayoutList } from 'lucide-react';
import { Dock, DockIcon } from '@/components/ui/dock';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Loader from './Loader';
import EndCallButton from './EndCallButton';
import { cn } from '@/lib/utils';

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setShowParticipants] = useState(false);
  const { useCallCallingState } = useCallStateHooks();

  // for more detail about types of CallingState see: https://getstream.io/video/docs/react/ui-cookbook/ringing-call/#incoming-call-panel
  const callingState = useCallCallingState();

  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    switch (layout) {
      case 'grid':
        return <PaginatedGridLayout />;
      case 'speaker-right':
        return <SpeakerLayout participantsBarPosition="left" />;
      default:
        return <SpeakerLayout participantsBarPosition="right" />;
    }
  };

  return (
    <section className="relative h-screen w-full overflow-hidden bg-dark-1/5 pt-4 text-white">
      <div className="relative flex size-full items-center justify-center">
        <div className=" flex size-full max-w-[1000px] items-center">
          <CallLayout />
        </div>
        <div
          className={cn('h-[calc(100vh-86px)] hidden ml-2', {
            'show-block': showParticipants,
          })}
        >
          <CallParticipantsList onClose={() => setShowParticipants(false)} />
        </div>
      </div>
      
      {/* Floating Control Dock */}
      <div className="fixed bottom-6 left-0 w-full flex justify-center z-50">
        <Dock 
          direction="middle" 
          className="bg-white/90 backdrop-blur-xl border-2 border-gray-200 shadow-2xl rounded-full px-3 py-2.5"
          iconSize={48}
          iconMagnification={64}
          iconDistance={100}
        >
          
          <div className="flex items-center gap-2 [&_.str-video__call-controls__button]:bg-gray-100 [&_.str-video__call-controls__button]:border [&_.str-video__call-controls__button]:border-gray-200 [&_.str-video__call-controls__button]:text-gray-700 hover:[&_.str-video__call-controls__button]:bg-gray-200 [&_.str-video__call-controls__button]:rounded-full [&_.str-video__call-controls__button]:w-12 [&_.str-video__call-controls__button]:h-12 [&_.str-video__call-controls__button]:transition-all">
              <CallControls onLeave={() => router.push(`/`)} />
          </div>

          <div className="w-[2px] h-10 bg-gray-200 mx-2" />

          <DockIcon>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-12 w-12 items-center justify-center rounded-full bg-transparent hover:bg-gray-100 transition-all border-none outline-none focus:outline-none data-[state=open]:bg-transparent">
                <LayoutList size={20} className="text-gray-700" />
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-white border-2 border-gray-200 text-gray-800 rounded-2xl shadow-2xl mb-4 min-w-[180px] p-2"
                sideOffset={8}
              >
                {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
                  <div key={index}>
                    <DropdownMenuItem
                      className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-800"
                      onClick={() =>
                        setLayout(item.toLowerCase() as CallLayoutType)
                      }
                    >
                      {item}
                    </DropdownMenuItem>
                    {index < 2 && <DropdownMenuSeparator className="bg-gray-200 my-1" />}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DockIcon>

          <DockIcon>
            <button className="flex h-12 w-12 items-center justify-center rounded-full bg-transparent hover:bg-gray-100 transition-all" onClick={() => setShowParticipants((prev) => !prev)}>
              <Users size={20} className="text-gray-700" />
            </button>
          </DockIcon>

          <EndCallButton />
        </Dock>
      </div>
    </section>
  );
};

export default MeetingRoom;
