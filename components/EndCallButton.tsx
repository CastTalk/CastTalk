'use client';

import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

const EndCallButton = () => {
  const call = useCall();
  const router = useRouter();

  if (!call)
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );

  // https://getstream.io/video/docs/react/guides/call-and-participant-state/#participant-state-3
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  const isMeetingOwner =
    localParticipant &&
    call.state.createdBy &&
    localParticipant.userId === call.state.createdBy.id;

  if (!isMeetingOwner) return null;

  const endCall = async () => {
    await call.endCall();
    router.push('/');
  };

  return (
    <>
      <div className="w-[2px] h-10 bg-gray-200 mx-2" />
      <div className="flex items-center h-12">
        <Button onClick={endCall} className="bg-red-500 hover:bg-red-600 h-10 px-3 py-1.5 text-xs rounded-full whitespace-nowrap">
          End Meeting
        </Button>
      </div>
    </>
  );
};

export default EndCallButton;
