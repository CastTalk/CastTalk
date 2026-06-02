# Notification System Database & Backend Integration Plan

This document outlines the roadmap and details for integrating a database (DB) and real-time backend with the notifications dropdown menu in **CastTalk**.

---

## 🛠️ Required Setup & Commands

To standardise the UI dropdown library if required in the future:
```bash
npx shadcn@latest add dropdown-menu
```

---

## 📅 Notification Trigger Events (To Be Implemented)

Once a database and websocket/polling mechanism are connected, the following notification triggers should be wired:

### 1. Meeting Scheduling Event
* **Event**: A user creates a new meeting.
* **Notification Text**: `Meeting scheduled successfully.` or `New meeting created for later.`
* **Action**: Inserts a record into the `notifications` table for the user.

### 2. Time-Based Reminders
* **Event**: Background cron job or scheduler detects a meeting is starting soon.
* **Notification Text**: `Meeting starts in 30 minutes.`
* **Action**: Automatically triggers a push notification or dropdown alert 30 minutes prior to `startsAt`.

### 3. Rescheduling Event
* **Event**: Host updates the time or date of an existing meeting.
* **Notification Text**: `Meeting has been rescheduled.`
* **Action**: Triggers update event and pushes notifications to all invited participants.

### 4. Meeting Close Event
* **Event**: A meeting has ended or is nearing its end.
* **Notification Text**: `Meeting scheduled is closed.`
* **Action**: Fired when the meeting status switches to ended or closed.

### 5. CastAI Integration
* **Event**: CastAI finishes processing the meeting transcript and generates notes.
* **Notification Text**: `CastAI generated a meeting summary.`
* **Action**: Triggers immediately after the background transcription and AI summarisation worker completes.

---

## 🗄️ Database Schema Design (Proposed)

### `notifications` Table

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier for each notification |
| `userId` | `VARCHAR` (Foreign Key) | Clerk User ID of the recipient |
| `text` | `TEXT` | Message content shown to the user |
| `type` | `VARCHAR` | Type of notification (`success`, `ai`, `alert`, `update`) |
| `read` | `BOOLEAN` (Default: `false`) | Read/Unread status indicator |
| `createdAt` | `TIMESTAMP` (Default: `NOW()`) | Date and time when the notification was created |

---

## 🔄 Real-Time Delivery Options

1. **Pusher / Socket.io**: For instantaneous, server-to-client real-time notification push when events occur.
2. **Next.js Server Actions & Polling**: Lightweight polling mechanism that checks for unread notifications every 30-60 seconds.
