"use client";

import { CheckCircle } from "@phosphor-icons/react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast
            key={id}
            {...props}
            className="border border-slate-300 bg-[#ecedef] text-slate-900 shadow-lg rounded-none min-w-[300px] p-4 pr-10"
            style={{ borderWidth: '0.8px' }}
          >
            <div className="flex items-center gap-3">
              {title && (
                <div 
                  className="size-8 flex-center shrink-0 bg-white border border-slate-300 text-black rounded-none"
                  style={{ borderWidth: '0.8px' }}
                >
                  <CheckCircle weight="regular" size={18} className="text-black" />
                </div>
              )}
              <div className="grid gap-0.5">
                {title && <ToastTitle className="text-sm font-normal text-slate-900">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-xs font-normal text-slate-500">{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose className="rounded-none hover:bg-black/5 p-1 text-black" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
