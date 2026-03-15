"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { avatarImages } from "@/constants";
import { useToast } from "./ui/use-toast";

interface MeetingCardProps {
  title: string;
  date: string;
  icon: string;
  isPreviousMeeting?: boolean;
  buttonIcon1?: string;
  buttonText?: string;
  handleClick: () => void;
  link: string;
}

const MeetingCard = ({
  icon,
  title,
  date,
  isPreviousMeeting,
  buttonIcon1,
  handleClick,
  link,
  buttonText,
}: MeetingCardProps) => {
  const { toast } = useToast();

  return (
    <section className="group flex min-h-[258px] w-full flex-col justify-between rounded-[24px] bg-dark-1/40 px-6 py-8 border border-white/5 backdrop-blur-lg shadow-lg hover:bg-dark-1/60 hover:border-white/10 transition-all duration-300 xl:max-w-[568px] relative overflow-hidden">
        
      {/* Subtle Glow Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <article className="flex flex-col gap-6 relative z-10">
        <div className="flex items-start justify-between">
            <div className="flex-center size-14 rounded-[16px] bg-white/5 border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                <Image src={icon} alt="upcoming" width={28} height={28} className="opacity-90" />
            </div>
            
            {/* Status Pill (Optional based on design) */}
            {!isPreviousMeeting && (
                <div className="px-3 py-1 rounded-full bg-blue-1/20 border border-blue-1/30 text-blue-400 text-xs font-semibold tracking-wide">
                    Upcoming
                </div>
            )}
            {isPreviousMeeting && (
                 <div className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wide">
                    Ended
                </div>
            )}
        </div>
        
        <div className="flex flex-col gap-1.5 mt-2">
            <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-100 transition-colors">{title}</h1>
            <p className="text-sm font-medium text-white/60">{date}</p>
        </div>
      </article>

      <article className="flex items-center justify-between w-full mt-6 relative z-10">
        <div className="relative flex w-full max-sm:hidden items-center group-hover:scale-105 transition-transform duration-300 origin-left">
          {avatarImages.map((img, index) => (
            <Image
              key={index}
              src={img}
              alt="attendees"
              width={40}
              height={40}
              className={cn("rounded-full border-[3px] border-dark-1/80 absolute shadow-sm transition-transform hover:z-20 hover:-translate-y-1")}
              style={{ top: -20, left: index * 26 }}
            />
          ))}
          <div className="flex-center absolute left-[130px] size-10 rounded-full border-[3px] border-dark-1/80 bg-white/10 backdrop-blur-md text-white/80 text-sm font-medium shadow-sm" style={{ top: -20}}>
            +5
          </div>
        </div>

        {!isPreviousMeeting && (
          <div className="flex gap-3 justify-end w-full">
            <Button 
                onClick={handleClick} 
                className="rounded-[10px] bg-blue-1 px-6 py-5 font-semibold text-white hover:bg-blue-1/90 shadow-[0_4px_12px_rgba(14,120,249,0.3)] transition-all"
            >
              {buttonIcon1 && (
                <Image src={buttonIcon1} alt="feature" width={18} height={18} className="mr-2" />
              )}
              {buttonText}
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast({ title: "Link Copied" });
              }}
              className="rounded-[10px] bg-white/5 border border-white/10 px-6 py-5 hover:bg-white/10 transition-all shadow-sm"
              variant="outline"
            >
              <Image
                src="/icons/copy.svg"
                alt="copy"
                width={18}
                height={18}
                className="mr-2 opacity-80"
              />
              Copy Link
            </Button>
          </div>
        )}
      </article>
    </section>
  );
};

export default MeetingCard;
