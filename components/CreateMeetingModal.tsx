'use client';
import { Copy, PlusCircle, CheckCircle, X } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleClick: () => void;
  values: { dateTime: Date; description: string; link: string; invitation?: string };
  setValues: (values: any) => void;
}

const CreateMeetingModal = ({
  isOpen,
  onClose,
  handleClick,
  values,
  setValues,
}: CreateMeetingModalProps) => {
  const { toast } = useToast();
  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${values.link}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex w-full max-w-[840px] flex-col gap-0 p-0 bg-white border-none shadow-2xl rounded-[32px] overflow-hidden font-heading">
        <DialogTitle className="sr-only">Create Meeting</DialogTitle>
        
        {/* Header */}
        <div className="flex flex-col gap-2 p-10 pb-6 border-b border-slate-100">
          <div className="size-14 rounded-2xl bg-primary/10 flex-center mb-2">
            <PlusCircle weight="bold" size={28} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Create Meeting
          </h1>
          <p className="text-sm text-slate-500 font-semibold">
            Instantly set up a new workspace and share the invitation link.
          </p>
        </div>

        {/* Body content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Left Block: Meeting Details */}
          <div className="flex flex-col gap-6 p-10 border-r border-slate-100">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                Meeting Details
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Provide a title for your instant session.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Topic</label>
              <Input
                placeholder="e.g. Design Sync"
                className="bg-slate-50 border-slate-100 focus-visible:ring-primary/20 text-slate-900 rounded-xl py-6 px-4 font-medium"
                onChange={(e) => setValues({ ...values, description: e.target.value })}
              />
            </div>
          </div>

          {/* Right Block: Invitation */}
          <div className="flex flex-col gap-6 p-10 bg-slate-50/50">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                Invitation
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                The link is auto-generated and ready to share.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                Access Link
              </label>
              <div className="flex flex-col gap-3">
                <Input
                  readOnly
                  value={meetingLink}
                  className="bg-white border-slate-100 text-slate-500 rounded-xl py-6 px-4 truncate font-medium shadow-sm"
                />
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-14 border-slate-100 bg-white hover:bg-slate-50 hover:text-primary hover:border-primary/20 flex items-center justify-center shadow-sm transition-all font-bold"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(meetingLink);
                    toast({ title: 'Link Copied' });
                  }}
                >
                  <Copy weight="bold" size={18} className="mr-2" />
                  Copy Invitation Link
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-10 py-8 border-t border-slate-100 flex justify-end items-center bg-white">
          <Button
            variant="ghost"
            className="mr-4 text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-bold rounded-xl px-8 h-14"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-10 h-14 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            onClick={handleClick}
          >
            Create & Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMeetingModal;
