import Notification from '../models/notification.models.js';

/**
 * In-app notifications (the bell). `pushNotification` never throws into the caller.
 */
export async function pushNotification(userIds, { type, title, body, link }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map(user => ({
      user,
      type,
      title: String(title).slice(0, 200),
      body: body ? String(body).slice(0, 400) : undefined,
      link
    })));
  } catch (error) {
    console.error('Could not save notification:', error.message);
  }
}

export async function listNotifications(userId) {
  const [items, unread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: userId, readAt: null })
  ]);
  return {
    unread,
    notifications: items.map(n => ({
      id: n._id, type: n.type, title: n.title, body: n.body || '', link: n.link || '', read: Boolean(n.readAt), createdAt: n.createdAt
    }))
  };
}

/** Marks the given notifications (or all, when ids is empty) as read. Only the owner's own. */
export async function markNotificationsRead(userId, ids = []) {
  const filter = { user: userId, readAt: null };
  if (Array.isArray(ids) && ids.length) filter._id = { $in: ids.filter(id => /^[a-f0-9]{24}$/i.test(String(id))) };
  await Notification.updateMany(filter, { readAt: new Date() });
  return listNotifications(userId);
}
