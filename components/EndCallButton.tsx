'use client';
import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { PhoneDisconnect } from '@phosphor-icons/react';

const EndCallButton = () => {
  const call = useCall();
  const router = useRouter();

  if (!call)
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );

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
    <Button 
      onClick={endCall} 
      className="bg-red-600 hover:bg-red-700 text-white rounded-full w-14 h-11 p-0 transition-all border border-red-700 flex items-center justify-center shrink-0 shadow-sm"
      style={{ borderWidth: '0.8px' }}
      title="End call for all"
    >
      <PhoneDisconnect weight="bold" size={20} />
    </Button>
  );
};

export default EndCallButton;
