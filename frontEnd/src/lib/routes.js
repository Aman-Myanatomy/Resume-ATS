/** Where a user lands after signing in, or when opening "/". */
export function homePath(user) {
  if (!user) return '/jobs';
  return user.role === 'employer' ? '/employer' : '/jobs';
}
