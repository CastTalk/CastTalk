import { ReactNode, ElementType } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { IconProps } from "@phosphor-icons/react";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children?: ReactNode;
  handleClick?: () => void;
  buttonText?: string;
  instantMeeting?: boolean;
  icon?: ElementType<IconProps>;
  buttonClassName?: string;
  buttonIcon?: ElementType<IconProps>;
}

const MeetingModal = ({
  isOpen,
  onClose,
  title,
  className,
  children,
  handleClick,
  buttonText,
  instantMeeting,
  icon: Icon,
  buttonClassName,
  buttonIcon: ButtonIcon,
}: MeetingModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex w-full max-w-[480px] flex-col gap-0 p-0 border-none bg-white overflow-hidden rounded-[32px] shadow-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        
        <div className="flex flex-col gap-8 p-10">
          {Icon && (
            <div className="flex justify-center">
              <div className="size-20 rounded-[24px] bg-slate-50 border border-slate-100 flex-center shadow-inner">
                <Icon weight="bold" size={36} className="text-primary" />
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <h1 className={cn("text-3xl font-bold text-center tracking-tight text-slate-900", className)}>
              {title}
            </h1>
          </div>

          {children && (
            <div className="flex flex-col gap-4">
              {children}
            </div>
          )}
          
          <Button
            className={cn(
              "w-full h-16 bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]",
              buttonClassName
            )}
            onClick={handleClick}
          >
            {ButtonIcon && (
              <ButtonIcon weight="bold" size={20} className="mr-3" />
            )}
            {buttonText || "Schedule Meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingModal;
