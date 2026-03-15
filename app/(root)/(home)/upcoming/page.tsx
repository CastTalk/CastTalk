import CallList from '@/components/CallList';
import Image from 'next/image';

const UpcomingPage = () => {
  return (
    <section className="flex size-full flex-col gap-8 text-dark-1">
      <div className="flex items-center gap-4">
        <div className="flex-center size-14 rounded-[16px] bg-blue-1/10 border border-blue-1/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <Image src="/icons/upcoming.svg" alt="upcoming" width={28} height={28} className="opacity-90 contrast-[0.9] brightness-[1.1]" style={{ filter: 'invert(100%) brightness(0.5) sepia(1) hue-rotate(180deg) saturate(5)'}} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-dark-1 to-dark-3">
            Upcoming Meetings
        </h1>
      </div>

      <div className="w-full flex-1">
        <CallList type="upcoming" />
      </div>
    </section>
  );
};

export default UpcomingPage;
