import { format, isBefore, startOfDay } from "date-fns";
import type { NotificationType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { taskReminderLabel, taskReminderOffsetMs } from "@/lib/task-reminders";
import type { Role } from "@/lib/utils";

type RequestUser = {
  id: string;
  role: Role;
  name?: string | null;
};

export type HeaderNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  href: string;
  read: boolean;
  createdAt: string;
};

function rolePath(role: Role, section: string) {
  const prefix = role === "ADMIN" ? "admin" : role === "SUPERVISOR" ? "supervisor" : "marketer";
  return `/${prefix}/${section}`;
}

function notificationFallbackHref(role: Role) {
  return role === "ADMIN" ? rolePath(role, "notifications") : rolePath(role, "communication");
}

function notificationHref(user: RequestUser, input: {
  entity?: string | null;
  entityId?: string | null;
  followUpLeadId?: string | null;
  followUpCompanyId?: string | null;
}) {
  if (input.followUpLeadId) return `/leads/${input.followUpLeadId}`;
  if (input.followUpCompanyId) return `/customers/${input.followUpCompanyId}`;
  if (input.entity === "Task") return rolePath(user.role, "tasks");
  if (input.entity === "FollowUp") return rolePath(user.role, "follow-ups");
  return notificationFallbackHref(user.role);
}

function formatNotificationType(type: string) {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasExplicitTime(date: Date | null | undefined) {
  if (!date) return false;
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
}

function taskDueAt(task: { taskTime: Date | null; dueDate: Date | null; taskDate: Date }) {
  return task.taskTime ?? task.dueDate ?? task.taskDate;
}

function taskReminderAt(task: { reminder: string | null; taskTime: Date | null; dueDate: Date | null; taskDate: Date }) {
  const offset = taskReminderOffsetMs(task.reminder);
  if (offset === null) return null;
  return new Date(taskDueAt(task).getTime() - offset);
}

async function sendDueFollowUpEmail(input: {
  to: string;
  type: NotificationType;
  message: string;
  followUpDate: Date;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  const appUrl = (process.env.AUTH_EMAIL_REDIRECT_TO ?? "https://crm.mugnee.com").replace(/\/$/, "");

  if (!apiKey || !from || !input.to) return false;

  const subject = input.type === "FOLLOW_UP_OVERDUE" ? "CRM overdue follow-up reminder" : "CRM follow-up due today";
  const prettyDate = format(input.followUpDate, "dd MMM yyyy hh:mm a");
  const intro = input.type === "FOLLOW_UP_OVERDUE"
    ? "A follow-up is still pending and already overdue."
    : "A follow-up is due today in your CRM queue.";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject,
        html: `<p>${intro}</p><p><strong>Follow-up time:</strong> ${prettyDate}</p><p><strong>Details:</strong> ${input.message}</p><p><a href="${appUrl}/login">Open Mugnee CRM</a></p>`,
        text: `${intro}\nFollow-up time: ${prettyDate}\nDetails: ${input.message}\nOpen CRM: ${appUrl}/login`,
      }),
    });

    if (!response.ok) {
      console.warn("Follow-up reminder email provider returned an error.", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Follow-up reminder email could not be sent.", error);
    return false;
  }
}

async function syncDueNotifications(user: RequestUser) {
  const prisma = getPrisma();
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [dueFollowUps, overdueTasks] = await Promise.all([
    prisma.followUp.findMany({
      where: {
        assignedToId: user.id,
        status: { not: "COMPLETED" },
        followUpDate: { lt: tomorrow },
      },
      select: {
        id: true,
        note: true,
        method: true,
        status: true,
        followUpDate: true,
        reminderSentAt: true,
      },
      take: 100,
    }),
    prisma.task.findMany({
      where: {
        assignedToId: user.id,
        status: { not: "COMPLETED" },
      },
      select: {
        id: true,
        title: true,
        taskDate: true,
        dueDate: true,
        taskTime: true,
        reminder: true,
      },
      take: 100,
    }),
  ]);

  const eligibleFollowUps = dueFollowUps.filter((followUp) =>
    hasExplicitTime(followUp.followUpDate) && followUp.followUpDate.getTime() <= now.getTime()
  );
  const overdueTaskRows = overdueTasks.filter((task) => isBefore(taskDueAt(task), now));
  const reminderTaskRows = overdueTasks.filter((task) => {
    const reminderAt = taskReminderAt(task);
    if (!reminderAt) return false;
    const dueAt = taskDueAt(task);
    return reminderAt.getTime() <= now.getTime() && dueAt.getTime() >= now.getTime();
  });
  const existing = await prisma.notification.findMany({
    where: {
      recipientId: user.id,
      OR: [
        ...(eligibleFollowUps.length
          ? [
              {
                type: { in: ["FOLLOW_UP_REMINDER", "FOLLOW_UP_OVERDUE"] as NotificationType[] },
                followUpId: { in: eligibleFollowUps.map((item) => item.id) },
              },
            ]
          : []),
        ...(overdueTaskRows.length
          ? [
              {
                type: "SYSTEM_ALERT" as NotificationType,
                entity: "Task",
                entityId: { in: overdueTaskRows.map((item) => item.id) },
              },
            ]
          : []),
        ...(reminderTaskRows.length
          ? [
              {
                type: "SYSTEM_ALERT" as NotificationType,
                entity: "Task",
                entityId: { in: reminderTaskRows.map((item) => item.id) },
              },
            ]
          : []),
      ],
    },
    select: {
      title: true,
      type: true,
      followUpId: true,
      entityId: true,
    },
  });

  const existingFollowUpKeys = new Set(
    existing
      .filter((item) => item.followUpId)
      .map((item) => `${item.type}:${item.followUpId}`),
  );
  const existingTaskKeys = new Set(
    existing
      .filter((item) => item.entityId)
      .map((item) => `${item.type}:${item.title}:${item.entityId}`),
  );

  const notificationsToCreate = [
    ...eligibleFollowUps.flatMap((followUp) => {
      const type: NotificationType = isBefore(followUp.followUpDate, today) ? "FOLLOW_UP_OVERDUE" : "FOLLOW_UP_REMINDER";
      const key = `${type}:${followUp.id}`;
      if (existingFollowUpKeys.has(key)) return [];
      return [{
        recipientId: user.id,
        title: type === "FOLLOW_UP_OVERDUE" ? "Overdue Follow-up" : "Follow-up Due",
        message: followUp.note?.trim() || `${followUp.method} follow-up is due.`,
        type,
        entity: "FollowUp",
        entityId: followUp.id,
        followUpId: followUp.id,
      }];
    }),
    ...overdueTaskRows.flatMap((task) => {
      const key = `SYSTEM_ALERT:Overdue Task:${task.id}`;
      if (existingTaskKeys.has(key)) return [];
      return [{
        recipientId: user.id,
        title: "Overdue Task",
        message: task.title,
        type: "SYSTEM_ALERT" as const,
        entity: "Task",
        entityId: task.id,
      }];
    }),
    ...reminderTaskRows.flatMap((task) => {
      const key = `SYSTEM_ALERT:Task Reminder:${task.id}`;
      if (existingTaskKeys.has(key)) return [];
      const dueAt = taskDueAt(task);
      return [{
        recipientId: user.id,
        title: "Task Reminder",
        message: `${task.title} at ${format(dueAt, "dd MMM yyyy hh:mm a")} (${taskReminderLabel(task.reminder)})`,
        type: "SYSTEM_ALERT" as const,
        entity: "Task",
        entityId: task.id,
      }];
    }),
  ];

  if (notificationsToCreate.length) {
    await Promise.all(
      notificationsToCreate.map((notification) =>
        prisma.notification.create({
          data: notification,
        }),
      ),
    );
  }

  const recipient = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });

  if (!recipient?.email) return;

  const followUpsNeedingEmail = eligibleFollowUps.filter((followUp) => !followUp.reminderSentAt);
  for (const followUp of followUpsNeedingEmail) {
    const type: NotificationType = isBefore(followUp.followUpDate, today) ? "FOLLOW_UP_OVERDUE" : "FOLLOW_UP_REMINDER";
    const emailSent = await sendDueFollowUpEmail({
      to: recipient.email,
      type,
      message: followUp.note?.trim() || `${followUp.method} follow-up is due.`,
      followUpDate: followUp.followUpDate,
    });
    if (emailSent) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { reminderSentAt: now },
      });
    }
  }
}

export async function getHeaderNotifications(user: RequestUser) {
  const prisma = getPrisma();
  await syncDueNotifications(user);

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    include: {
      followUp: {
        select: {
          leadId: true,
          companyId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const rows: HeaderNotificationItem[] = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    type: formatNotificationType(item.type),
    href: notificationHref(user, {
      entity: item.entity,
      entityId: item.entityId,
      followUpLeadId: item.followUp?.leadId,
      followUpCompanyId: item.followUp?.companyId,
    }),
    read: Boolean(item.readAt),
    createdAt: format(item.createdAt, "dd MMM, hh:mm a"),
  }));

  return {
    rows,
    unreadCount: rows.filter((item) => !item.read).length,
  };
}

export async function markNotificationRead(user: RequestUser, id: string) {
  const prisma = getPrisma();
  const notification = await prisma.notification.findFirst({
    where: { id, recipientId: user.id },
    select: { id: true },
  });
  if (!notification) return false;

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return true;
}

export async function markAllNotificationsRead(user: RequestUser) {
  const prisma = getPrisma();
  await prisma.notification.updateMany({
    where: {
      recipientId: user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
