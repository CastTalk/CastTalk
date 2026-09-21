'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Check, X } from '@phosphor-icons/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

interface WaitingUser {
  userId: string;
  userName: string;
  userImage?: string;
}

interface AcceptCallProps {
  waitingQueue: WaitingUser[];
  onAdmitUser: (userId: string) => void;
  onDenyUser: (userId: string) => void;
  onAdmitAll?: () => void;
}

export const AcceptCall: React.FC<AcceptCallProps> = ({
  waitingQueue,
  onAdmitUser,
  onDenyUser,
  onAdmitAll,
}) => {
  if (!waitingQueue || waitingQueue.length === 0) return null;

  const count = waitingQueue.length;
  const labelText =
    count === 1
      ? `${waitingQueue[0].userName} request to join`
      : `${count} participants request to join`;

  return (
    <AnimatePresence>
      <Popover>
        <PopoverTrigger asChild>
          <motion.div
            initial={{ scale: 0.8, opacity: 0, x: 20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0.8, opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="flex items-center gap-2 bg-[#6fd98b] text-[#04210c] pl-1.5 pr-3.5 py-1 rounded-full text-xs font-semibold shadow-md cursor-pointer hover:bg-[#5cdb87] transition-all select-none"
            title="Click to manage join requests"
          >
            <div className="size-6 rounded-full bg-[#004f21] text-[#6fd98b] flex items-center justify-center shrink-0">
              <UserCircle size={16} weight="bold" />
            </div>
            <span className="font-semibold text-xs tracking-tight truncate max-w-[220px]">
              {labelText}
            </span>
          </motion.div>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 p-4 bg-[#202124] border border-[#3c4043] text-white shadow-2xl rounded-2xl font-sans"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#3c4043]">
            <div className="flex items-center gap-2">
              <UserCircle size={20} className="text-[#6fd98b]" weight="bold" />
              <span className="font-bold text-sm">Join Requests ({count})</span>
            </div>
            {count > 1 && onAdmitAll && (
              <button
                onClick={onAdmitAll}
                className="text-xs font-bold text-[#6fd98b] hover:underline"
              >
                Admit All
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
            {waitingQueue.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#28292c] border border-[#3c4043]/50"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {user.userImage ? (
                    <img
                      src={user.userImage}
                      alt={user.userName}
                      className="size-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-[#004f21] text-[#6fd98b] flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                      {user.userName[0]}
                    </div>
                  )}
                  <span className="text-xs font-medium text-white truncate">
                    {user.userName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onDenyUser(user.userId)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                    title="Deny"
                  >
                    <X size={14} weight="bold" />
                  </button>
                  <button
                    onClick={() => onAdmitUser(user.userId)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Check size={14} weight="bold" />
                    <span>Admit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </AnimatePresence>
  );
};

export default AcceptCall;
