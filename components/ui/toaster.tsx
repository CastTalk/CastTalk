"use client";

import { CheckCircle2 } from "lucide-react";
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
            className="border border-white/40 bg-[rgba(200,203,210,0.75)] backdrop-blur-md text-gray-900 shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-md min-w-[240px] w-fit"
          >
            <div className="flex items-center gap-2.5">
              {title && (
                <CheckCircle2 size={18} strokeWidth={1.8} className="text-green-600 shrink-0" />
              )}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
