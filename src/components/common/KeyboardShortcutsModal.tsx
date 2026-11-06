'use client';

import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '/', description: 'Focus Global Search' },
    { key: 'Cmd + K / Ctrl + K', description: 'Open Global Command Palette' },
    { key: '?', description: 'Open Keyboard Shortcuts Cheat Sheet' },
    { key: 'Esc', description: 'Close modals / Context menus / Reset selection' },
    { key: 'G then D', description: 'Jump to Overview Dashboard' },
    { key: 'G then R', description: 'Jump to Request Log Explorer' },
    { key: 'G then A', description: 'Jump to Analytics & Charts' },
    { key: 'G then N', description: 'Jump to Anomaly Detection Rules' },
    { key: 'G then S', description: 'Jump to Observability Settings' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts Cheat Sheet"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#131B2E] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-slate-200 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0F17]/90">
          <div className="flex items-center gap-2.5">
            <Command className="h-5 w-5 text-indigo-400" />
            <h2 className="font-semibold text-white text-base">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80"
            >
              <span className="text-sm text-slate-300">{sc.description}</span>
              <kbd className="font-mono text-xs font-semibold px-2 py-1 rounded bg-[#0B0F17] text-indigo-300 border border-indigo-500/30 shadow-inner">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-[#0B0F17]/80 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
