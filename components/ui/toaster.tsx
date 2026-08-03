"use client";

import { CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const titleText = typeof title === 'string' ? title.toLowerCase() : '';
        let variant: 'success' | 'error' | 'info' = 'info';
        let Icon = Info;

        if (props.variant === 'destructive') {
          variant = 'error';
          Icon = WarningCircle;
        } else if (
          titleText.includes('fail') || 
          titleText.includes('error') || 
          titleText.includes('please') || 
          titleText.includes('conflict') || 
          titleText.includes('invalid')
        ) {
          variant = 'error';
          Icon = WarningCircle;
        } else if (
          titleText.includes('start') || 
          titleText.includes('create') || 
          titleText.includes('copy') || 
          titleText.includes('success') || 
          titleText.includes('cancel') || 
          titleText.includes('update') || 
          titleText.includes('schedule')
        ) {
          variant = 'success';
          Icon = CheckCircle;
        }

        return (
          <Toast
            key={id}
            {...props}
            className={cn(
              "pointer-events-auto relative flex items-center justify-between gap-3 overflow-hidden !rounded-sm px-4 py-2.5 !shadow-[0_2px_8px_rgba(0,0,0,0.15)] border-0 transition-all text-white min-w-[260px]",
              variant === "success" && "bg-emerald-500",
              variant === "error" && "bg-red-500",
              variant === "info" && "bg-blue-500"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-white" weight="bold" />
              <div className="flex flex-col gap-0.5">
                {title && (
                  <ToastTitle className="text-xs font-semibold text-white tracking-normal">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-[10px] font-normal text-white/90 leading-normal">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-4 w-px shrink-0",
                  variant === "success" && "bg-emerald-400",
                  variant === "error" && "bg-red-400",
                  variant === "info" && "bg-blue-400"
                )}
              />
              {action ? (
                <div className="text-xs font-semibold text-white hover:underline shrink-0">
                  {action}
                </div>
              ) : (
                <ToastClose 
                  className="relative right-auto top-auto translate-y-0 opacity-100 p-0.5 text-white hover:bg-white/10 hover:text-white transition-colors"
                />
              )}
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
