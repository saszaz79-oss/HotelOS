'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/cn';
import {
  fetchNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationListItem,
} from './notifications-actions';

interface Dict {
  title: string;
  empty: string;
  markAllRead: string;
  unreadBadge: string;
}

export function NotificationBell({ locale, dict, initialUnreadCount }: { locale: Locale; dict: Dict; initialUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationListItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const data = await fetchNotificationsAction();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    }
  }

  async function onItemClick(item: NotificationListItem) {
    if (item.readAt) return;
    setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) : prev));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationReadAction(item.id);
  }

  async function onMarkAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => (prev ? prev.map((i) => ({ ...i, readAt: i.readAt ?? now })) : prev));
    setUnreadCount(0);
    await markAllNotificationsReadAction();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-md p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
        aria-label={dict.title}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="metric-value absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute bottom-full start-0 z-20 mb-2 w-80 rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_18px_44px_-16px_hsl(var(--shadow-color)/0.45)]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--glass-border))] px-3 py-2.5">
            <span className="text-sm font-medium text-ink">{dict.title}</span>
            {items && items.some((i) => !i.readAt) ? (
              <button type="button" onClick={onMarkAllRead} className="text-xs text-accent hover:underline">
                {dict.markAllRead}
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items === null ? (
              <p className="p-4 text-center text-sm text-ink-muted">…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-center text-sm text-ink-muted">{dict.empty}</p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--glass-border))]">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onItemClick(item)}
                      className={cn('block w-full px-3 py-2.5 text-start text-sm transition-colors hover:bg-ink/[0.03]', !item.readAt && 'bg-accent/5')}
                    >
                      <div className="flex items-start gap-2">
                        {!item.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ink">{locale === 'ar' ? item.titleAr : item.titleEn}</p>
                          {(locale === 'ar' ? item.bodyAr : item.bodyEn) ? (
                            <p className="mt-0.5 truncate text-xs text-ink-muted">{locale === 'ar' ? item.bodyAr : item.bodyEn}</p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {item.hotelName ? `${item.hotelName} · ` : ''}
                            {new Date(item.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path
        d="M10 3a4 4 0 0 0-4 4v2.2c0 .5-.16 1-.46 1.4L4.3 12.4c-.6.8-.02 1.95.98 1.95h9.44c1 0 1.58-1.15.98-1.95l-1.24-1.8a2.3 2.3 0 0 1-.46-1.4V7a4 4 0 0 0-4-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.3 16.5a1.8 1.8 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}
