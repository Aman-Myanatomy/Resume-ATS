import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarCheck, CalendarX, CheckCheck, UserPlus, Users, ArrowRightLeft } from 'lucide-react';
import { useGetNotificationsQuery, useMarkNotificationsReadMutation } from '../store/api/publicApi.js';
import { timeAgo } from '../lib/format.js';

const TYPE_ICON = {
  new_applicant: UserPlus,
  stage_change: ArrowRightLeft,
  interview_scheduled: CalendarCheck,
  interview_cancelled: CalendarX,
  invite_accepted: Users
};

/** Bell with unread badge and a dropdown of recent notifications. Polls every minute. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data } = useGetNotificationsQuery(undefined, { pollingInterval: 60000, refetchOnFocus: true });
  const [markRead] = useMarkNotificationsReadMutation();
  const unread = data?.unread || 0;
  const items = data?.notifications || [];

  useEffect(() => {
    if (!open) return undefined;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = item => {
    if (!item.read) markRead([item.id]);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="jb-bell" ref={ref}>
      <button type="button" className="jb-icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(v => !v)}>
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="jb-bell-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="jb-bell-panel" role="dialog" aria-label="Notifications">
          <div className="jb-bell-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="text-button" onClick={() => markRead([])}>
                <CheckCheck size={14} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="jb-bell-empty">You're all caught up. New applicants, interviews and status updates will show up here.</p>
          ) : (
            <ul className="jb-bell-list">
              {items.map(item => {
                const Icon = TYPE_ICON[item.type] || Bell;
                return (
                  <li key={item.id}>
                    <button type="button" className={`jb-bell-item ${item.read ? '' : 'unread'}`} onClick={() => openItem(item)}>
                      <span className="jb-bell-icon"><Icon size={16} aria-hidden="true" /></span>
                      <span className="jb-bell-text">
                        <strong>{item.title}</strong>
                        {item.body && <span>{item.body}</span>}
                        <small>{timeAgo(item.createdAt)}</small>
                      </span>
                      {!item.read && <span className="jb-unread-dot" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
