import { ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { avatarImages } from "@/constants";
import { useToast } from "./ui/use-toast";
import { IconProps, Copy, Play } from "@phosphor-icons/react";
import Image from "next/image";

interface MeetingCardProps {
  title: string;
  date: string;
  icon: ElementType<IconProps>;
  isPreviousMeeting?: boolean;
  buttonIcon1?: ElementType<IconProps>;
  buttonText?: string;
  handleClick: () => void;
  link: string;
}

const MeetingCard = ({
  icon: Icon,
  title,
  date,
  isPreviousMeeting,
  buttonIcon1: ButtonIcon,
  handleClick,
  link,
  buttonText,
}: MeetingCardProps) => {
  const { toast } = useToast();

  return (
    <section className="group flex min-h-[260px] w-full flex-col justify-between rounded-[32px] bg-white p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
        
      {/* Subtle background decoration */}
      <div className="absolute -bottom-20 -right-20 size-40 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />

      <article className="flex flex-col gap-6 relative z-10">
        <div className="flex items-start justify-between">
            <div className="size-14 rounded-2xl bg-slate-50 border border-slate-100 flex-center shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Icon weight="bold" size={28} className="text-primary" />
            </div>
            
            {!isPreviousMeeting ? (
                <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                    Upcoming
                </div>
            ) : (
                 <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    Ended
                </div>
            )}
        </div>
        
        <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">{title}</h1>
            <p className="text-sm font-semibold text-slate-400 group-hover:text-slate-500 transition-colors">{date}</p>
        </div>
      </article>

      <article className="flex items-center justify-between w-full mt-6 relative z-10">
        <div className="relative flex w-full max-sm:hidden items-center">
          {avatarImages.slice(0, 4).map((img, index) => (
            <div 
              key={index} 
              className="relative transition-transform hover:-translate-y-1 hover:z-20 duration-300"
              style={{ marginLeft: index === 0 ? 0 : -12 }}
            >
              <Image
                src={img}
                alt="attendees"
                width={40}
                height={40}
                className="rounded-full border-[3px] border-white shadow-sm"
              />
            </div>
          ))}
          {avatarImages.length > 4 && (
            <div 
              className="size-10 rounded-full border-[3px] border-white bg-slate-100 flex-center text-slate-500 text-[11px] font-bold shadow-sm relative z-10"
              style={{ marginLeft: -12 }}
            >
              +{avatarImages.length - 4}
            </div>
          )}
        </div>

        {!isPreviousMeeting && (
          <div className="flex gap-3 justify-end w-full">
            <Button 
                onClick={handleClick} 
                className="rounded-2xl bg-primary h-14 px-8 font-bold text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              {ButtonIcon && (
                <ButtonIcon weight="bold" size={18} className="mr-2" />
              )}
              {buttonText}
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast({ title: "Link Copied" });
              }}
              className="rounded-2xl bg-white border border-slate-100 h-14 px-6 hover:bg-slate-50 transition-all shadow-sm group/copy"
              variant="outline"
            >
              <Copy weight="bold" size={18} className="mr-2 text-slate-400 group-hover/copy:text-primary transition-colors" />
              <span className="text-slate-600 font-bold">Copy</span>
            </Button>
          </div>
        )}
      </article>
    </section>
  );
};

export default MeetingCard;
