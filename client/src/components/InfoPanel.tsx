import React from 'react';
import { FaTelegramPlane } from 'react-icons/fa'; // install react-icons if not already

export default function InfoPanel() {
  return (
    <div className="rounded-2xl p-6 text-center bg-gradient-to-r from-sky-100 to-slate-100 ring-1 ring-black/5 shadow-sm">
      <p className="text-lg font-semibold text-slate-800 tracking-tight">
        Assalamu Walaikum mate :)
      </p>

      <p className="text-slate-600 mt-2">
        This is a fun project I created. Since I’m not a programmer yet, there are mistakes, 
        and I even skipped some logical operation because it was tough for me to implement. 
        So, please look at it with a positive outlook. Ummm, enjoy your first blockchain 
        experience and feel the decentralization! 😊
      </p>

      <p className="text-slate-600 mt-4">
        Find me on{' '}
        <a
          href="https://t.me/nurrabby"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sky-600 font-medium hover:text-sky-800 hover:underline transition-colors"
        >
          <FaTelegramPlane className="text-sky-500" />
          Telegram
        </a>
      </p>
    </div>
  );
}
