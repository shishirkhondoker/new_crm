"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormModal } from "@/components/shared/form-modal";
import type { TodayWorkQueueItem } from "@/lib/task-center";

type ActionResult = { ok?: boolean; message?: string; [key: string]: unknown } | unknown;

type CrmPipelineStep = "Call" | "Follow-up" | "Demo Send" | "Quotation" | "Sale Won" | "Lead Lost";

type FollowUpEditWorkspace = {
  products: Array<{
    id: string;
    name: string;
  }>;
};

export type EditableFollowUpModalItem = Pick<
  TodayWorkQueueItem,
  | "sourceId"
  | "sourceType"
  | "title"
  | "companyName"
  | "companyPrimaryPhone"
  | "companyId"
  | "method"
  | "taskDateIso"
  | "description"
  | "notes"
  | "productId"
  | "productName"
  | "priority"
  | "priorityKey"
> & {
  taskId?: string | null;
  linkedTaskTitle?: string | null;
  linkedTaskNotes?: string | null;
  linkedTaskReminder?: string | null;
  linkedTaskProductId?: string | null;
  linkedTaskProductName?: string | null;
  linkedTaskPriorityKey?: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  linkedTaskDateIso?: string | null;
  statusKey: "PENDING" | "COMPLETED";
};

function dateTimeLocalValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeCrmPipelineStep(value?: string | null): CrmPipelineStep | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "call" || normalized === "phone call") return "Call";
  if (normalized === "follow-up" || normalized === "follow up") return "Follow-up";
  if (normalized === "demo send" || normalized === "demo") return "Demo Send";
  if (normalized === "quotation" || normalized === "quote" || normalized === "quatation") return "Quotation";
  if (normalized === "sale" || normalized === "sale won" || normalized === "won" || normalized === "conversion") return "Sale Won";
  if (normalized === "lead lost" || normalized === "lost") return "Lead Lost";
  return null;
}

function initialTaskTitle(item: EditableFollowUpModalItem) {
  const normalizedTaskTitle = normalizeCrmPipelineStep(item.linkedTaskTitle ?? item.title);
  if (normalizedTaskTitle === "Sale Won") return "Sale";
  if (normalizedTaskTitle === "Lead Lost") return "Follow-up";
  return normalizedTaskTitle ?? "Follow-up";
}

function initialSelectedProductId(item: EditableFollowUpModalItem, workspace: FollowUpEditWorkspace) {
  return item.linkedTaskProductId
    ?? item.productId
    ?? workspace.products.find((product) => product.name === (item.linkedTaskProductName ?? item.productName))?.id
    ?? ((item.linkedTaskProductName ?? item.productName) && (item.linkedTaskProductName ?? item.productName) !== "-" ? "__linked_product__" : "");
}

function meaningfulModalText(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized === "-") return "";
  return normalized;
}

function FollowUpEditForm({
  item,
  workspace,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: EditableFollowUpModalItem;
  workspace: FollowUpEditWorkspace;
  onClose: () => void;
  onSaved: (result?: ActionResult) => void;
  onDeleted: (result?: ActionResult) => void;
}) {
  const taskTitleOptions = ["Call", "Follow-up", "Demo Send", "Quotation", "Sale"];
  const baseDate = new Date(item.taskDateIso);
  const hasTime = baseDate.getHours() !== 0 || baseDate.getMinutes() !== 0 || baseDate.getSeconds() !== 0 || baseDate.getMilliseconds() !== 0;
  const [method, setMethod] = React.useState(item.method || "Phone Call");
  const [followUpDate, setFollowUpDate] = React.useState(dateTimeLocalValue(baseDate).slice(0, 10));
  const [followUpTime, setFollowUpTime] = React.useState(hasTime ? dateTimeLocalValue(baseDate).slice(11, 16) : "10:00");
  const taskNote = React.useMemo(() => meaningfulModalText(item.linkedTaskNotes), [item.linkedTaskNotes]);
  const [followUpNote, setFollowUpNote] = React.useState(() => meaningfulModalText(item.description));
  const [nextDiscussionPlan, setNextDiscussionPlan] = React.useState(item.notes !== "-" ? item.notes : "");
  const [taskTitle, setTaskTitle] = React.useState(initialTaskTitle(item));
  const [selectedProductId, setSelectedProductId] = React.useState(initialSelectedProductId(item, workspace));
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const canEditLinkedTask = Boolean(item.taskId);
  const isCompletedItem = item.statusKey === "COMPLETED";
  const phoneLabel = item.companyPrimaryPhone && item.companyPrimaryPhone !== "-" ? item.companyPrimaryPhone : "No phone number";
  const priorityLabel = item.priority ?? "Medium";
  const productLabel = item.linkedTaskProductName ?? item.productName;
  const linkedProductOption = !productLabel || productLabel === "-"
    ? null
    : workspace.products.some((product) => product.id === selectedProductId || product.name === productLabel)
      ? null
      : { id: "__linked_product__", name: productLabel };
  const visibleProducts = linkedProductOption ? [linkedProductOption, ...workspace.products] : workspace.products;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/follow-ups/${item.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          followUpDate,
          followUpTime,
          followUpDateTzOffset: new Date().getTimezoneOffset(),
          note: followUpNote,
          nextDiscussionPlan,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Follow-up update failed.");
      }
      if (item.taskId) {
        const linkedTaskDate = item.linkedTaskDateIso ? new Date(item.linkedTaskDateIso) : new Date(item.taskDateIso);
        const linkedTaskDateValue = dateTimeLocalValue(linkedTaskDate);
        const taskResponse = await fetch(`/api/tasks/${item.taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle === "Sale" ? "Sale Won" : taskTitle,
            companyId: item.companyId ?? "",
            companyName: item.companyName,
            notes: taskNote,
            reminder: item.linkedTaskReminder ?? "",
            priority: item.linkedTaskPriorityKey ?? item.priorityKey,
            taskDateTime: linkedTaskDateValue,
            productId: selectedProductId === "__linked_product__" ? item.linkedTaskProductId ?? item.productId ?? "" : selectedProductId,
          }),
        });
        const taskResult = await taskResponse.json();
        if (!taskResponse.ok) {
          throw new Error(typeof taskResult.message === "string" ? taskResult.message : "Task update failed.");
        }
      }
      onSaved(result);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow-up update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/follow-ups/${item.sourceId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Follow-up delete failed.");
      }
      onDeleted(result);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow-up delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Task Title</span>
          <select
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            disabled={!canEditLinkedTask}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {taskTitleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Product</span>
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            disabled={!canEditLinkedTask}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">Select product</option>
            {visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/80 p-4">
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Company Name</span>
            <Input value={item.companyName} readOnly className="font-semibold" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Phone</span>
            <Input value={phoneLabel} readOnly className="font-semibold" />
          </label>
        </div>
        {!canEditLinkedTask ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            This follow-up does not have a linked task record, so step and product are read-only here.
          </p>
        ) : null}
      </div>
      {canEditLinkedTask ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Task Note</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{taskNote || "No task note saved yet."}</p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Method</span>
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          >
            <option>Phone Call</option>
            <option>WhatsApp</option>
            <option>Email</option>
            <option>Physical Visit</option>
            <option>Meeting</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">{isCompletedItem ? "Scheduled Date" : "Follow-up Date"}</span>
          <Input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} required />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">{isCompletedItem ? "Scheduled Time" : "Follow-up Time"}</span>
          <Input type="time" value={followUpTime} onChange={(event) => setFollowUpTime(event.target.value)} />
        </label>
        {isCompletedItem ? (
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Priority</span>
            <Input value={priorityLabel} readOnly className="font-semibold" />
          </label>
        ) : null}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Follow-up Note</span>
        <textarea
          value={followUpNote}
          onChange={(event) => setFollowUpNote(event.target.value)}
          placeholder="Follow-up note"
          className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Next Discussion Plan</span>
        <textarea
          value={nextDiscussionPlan}
          onChange={(event) => setNextDiscussionPlan(event.target.value)}
          placeholder="Next update / discussion plan"
          className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : isCompletedItem ? "Update Task" : "Update Follow-up"}</Button>
        {!isCompletedItem ? <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>Delete</Button> : null}
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}

export function FollowUpEditModal({
  item,
  workspace,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: EditableFollowUpModalItem | null;
  workspace: FollowUpEditWorkspace;
  onClose: () => void;
  onSaved: (result?: ActionResult) => void;
  onDeleted: (result?: ActionResult) => void;
}) {
  const isOpen = Boolean(item && item.sourceType === "FOLLOW_UP");
  const modalTitle = item?.statusKey === "COMPLETED" ? "Edit Task" : "Edit Follow-up";
  const formKey = item
    ? `${item.sourceId}:${item.statusKey}:${item.taskDateIso}:${item.productId ?? ""}:${item.productName}`
    : "follow-up-empty";

  return (
    <FormModal open={isOpen} title={modalTitle} onClose={onClose} panelClassName="max-w-2xl">
      {item && item.sourceType === "FOLLOW_UP" ? (
        <FollowUpEditForm
          key={formKey}
          item={item}
          workspace={workspace}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ) : null}
    </FormModal>
  );
}
