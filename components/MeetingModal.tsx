"use client";
import { ReactNode } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Image from "next/image";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children?: ReactNode;
  handleClick?: () => void;
  buttonText?: string;
  instantMeeting?: boolean;
  image?: string;
  buttonClassName?: string;
  buttonIcon?: string;
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
  image,
  buttonClassName,
  buttonIcon,
}: MeetingModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex w-full max-w-[480px] flex-col gap-6 px-10 py-10">
        <div className="flex flex-col gap-6">
          {image && (
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center size-20 rounded-[20px] bg-[#252A41]/60 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-md">
                <Image src={image} alt="icon" width={36} height={36} className="opacity-90" />
              </div>
            </div>
          )}
          <h1 className={cn("text-2xl font-bold text-center mb-2", className)}>
            {title}
          </h1>
          {children}
          
          <Button
            className={cn(
              "w-full bg-[#0E78F9] hover:bg-blue-600 text-white font-medium rounded-md py-6 mt-4",
              buttonClassName
            )}
            onClick={handleClick}
          >
            {buttonIcon && (
              <Image
                src={buttonIcon}
                alt="button icon"
                width={13}
                height={13}
                className="mr-2"
              />
            )}
            {buttonText || "Schedule Meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingModal;
