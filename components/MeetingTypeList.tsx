'use client';
import { VideoCamera, Link, Calendar, FilmReel, X, ClipboardText, CheckCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import HomeCard from './HomeCard';
import MeetingModal from './MeetingModal';
import CreateMeetingModal from './CreateMeetingModal';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import Loader from './Loader';
import { Textarea } from './ui/textarea';
import ReactDatePicker from 'react-datepicker';
import { useToast } from './ui/use-toast';
import { Input } from './ui/input';

const initialValues = {
  dateTime: new Date(),
  description: '',
  link: '',
};

const MeetingTypeList = () => {
  const router = useRouter();
  const [meetingState, setMeetingState] = useState<
    'isScheduleMeeting' | 'isJoiningMeeting' | 'isInstantMeeting' | undefined
  >(undefined);
  const [values, setValues] = useState(initialValues);
  const [callDetail, setCallDetail] = useState<Call>();
  const client = useStreamVideoClient();
  const { user } = useUser();
  const { toast } = useToast();

  const createMeeting = async () => {
    if (!client || !user) return;
    try {
      if (!values.dateTime) {
        toast({ title: 'Please select a date and time' });
        return;
      }
      const id = values.link || crypto.randomUUID();
      const call = client.call('default', id);
      if (!call) throw new Error('Failed to create meeting');
      const startsAt =
        values.dateTime.toISOString() || new Date(Date.now()).toISOString();
      const description = values.description || 'Instant Meeting';
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            description,
          },
        },
      });
      setCallDetail(call);
      if (!values.description || meetingState === 'isInstantMeeting') {
        router.push(`/meeting/${call.id}`);
      }
      toast({
        title: 'Meeting Created',
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create Meeting' });
    }
  };

  if (!client || !user) return <Loader />;

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetail?.id}`;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <HomeCard
        icon={VideoCamera}
        title="New Meeting"
        description="Start an instant meeting"
        iconColor="text-orange-500"
        handleClick={() => {
          setValues({ ...initialValues, link: crypto.randomUUID() });
          setMeetingState('isInstantMeeting');
        }}
      />
      <HomeCard
        icon={Link}
        title="Join Meeting"
        description="Via invitation link"
        iconColor="text-blue-500"
        handleClick={() => setMeetingState('isJoiningMeeting')}
      />
      <HomeCard
        icon={Calendar}
        title="Schedule"
        description="Plan your meetings"
        iconColor="text-purple-500"
        handleClick={() => setMeetingState('isScheduleMeeting')}
      />
      <HomeCard
        icon={FilmReel}
        title="Recordings"
        description="View past meetings"
        iconColor="text-emerald-500"
        handleClick={() => router.push('/recordings')}
      />

      {!callDetail ? (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Create Meeting"
          handleClick={createMeeting}
          icon={Calendar}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                Description
              </label>
              <Textarea
                placeholder="What is this meeting about?"
                className="bg-slate-50 border-slate-100 text-slate-900 focus-visible:ring-primary/20 rounded-xl min-h-[100px] p-4"
                onChange={(e) =>
                  setValues({ ...values, description: e.target.value })
                }
              />
            </div>
            <div className="flex w-full flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                Select Date and Time
              </label>
              <div className="relative group">
                <ReactDatePicker
                  selected={values.dateTime}
                  onChange={(date) => setValues({ ...values, dateTime: date! })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  timeCaption="time"
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="w-full rounded-xl bg-slate-50 border border-slate-100 text-slate-900 p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
                <Calendar weight="bold" size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </MeetingModal>
      ) : (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Meeting Created"
          handleClick={() => {
            navigator.clipboard.writeText(meetingLink);
            toast({ title: 'Link Copied' });
          }}
          icon={CheckCircle}
          buttonIcon={ClipboardText}
          className="text-center"
          buttonText="Copy Meeting Link"
        />
      )}

      <MeetingModal
        isOpen={meetingState === 'isJoiningMeeting'}
        onClose={() => setMeetingState(undefined)}
        title="Join a Meeting"
        className="text-center"
        buttonText="Join Meeting"
        handleClick={() => router.push(values.link)}
        icon={Link}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 font-medium -mt-2">Enter the invitation link or meeting ID below</p>
          <Input
            placeholder="https://cancast.com/meeting/..."
            onChange={(e) => setValues({ ...values, link: e.target.value })}
            className="bg-slate-50 border-slate-100 text-slate-900 focus-visible:ring-primary/20 rounded-xl py-6 px-4 font-medium"
          />
        </div>
      </MeetingModal>

      <CreateMeetingModal
        isOpen={meetingState === 'isInstantMeeting'}
        onClose={() => setMeetingState(undefined)}
        handleClick={createMeeting}
        values={values}
        setValues={setValues}
      />
    </section>
  );
};

export default MeetingTypeList;
