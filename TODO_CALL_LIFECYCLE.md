# Production Call Lifecycle Checklist (TODO)

This document outlines the recommended production patterns for managing Stream Video call lifecycles, replacing development-only workarounds like `setTimeout` delays.

---

## 1. Explicit Leave on User Hangup
- [ ] Keep `call.leave()` inside the main `hangup` / End Call button handler.
- [ ] Mark a ref (`hasLeftRef.current = true`) so subsequent cleanup hooks know the user already left cleanly.
- [ ] Redirect the user to `/` or a meeting summary/feedback screen.

```tsx
const hangup = async () => {
  if (!call) return;
  hasLeftRef.current = true;
  try {
    await call.leave();
    router.push('/');
    toast({ title: 'Left meeting room' });
  } catch (error) {
    console.error('Error leaving call:', error);
  }
};
```

---

## 2. Immediate Route/Page Unmount Cleanup (No `setTimeout`)
- [ ] Remove all `setTimeout(..., 1500)` delays and `pendingLeaves` Maps.
- [ ] Run `call.leave()` immediately only if the user navigates away without clicking the hangup button (e.g., using browser back/forward or internal link).

```tsx
useEffect(() => {
  return () => {
    // Only triggers if the component unmounts without having clicked the leave button
    if (call && !hasLeftRef.current) {
      call.leave().catch(() => {});
    }
  };
}, [call]);
```

---

## 3. Browser Tab Close / Refresh Listener (`beforeunload`)
- [ ] Add a `beforeunload` listener so Stream disconnects immediately if the user closes the tab, refreshes, or enters a new URL in the address bar.

```tsx
useEffect(() => {
  const handleBeforeUnload = () => {
    if (call && !hasLeftRef.current) {
      call.leave().catch(() => {});
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [call]);
```

---

## 4. Remove Dev-Only Hacks Before Release
- [ ] Remove the global `pendingLeaves` Map from `components/MeetingRoom.tsx`.
- [ ] Verify that navigating away, refreshing the tab, and clicking hangup all disconnect cleanly without any phantom delays.
