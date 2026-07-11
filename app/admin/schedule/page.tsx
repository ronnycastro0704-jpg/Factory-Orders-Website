import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import ScheduleBoard from "./schedule-board";

type ScheduledOrder = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  status: string;
  priority: string;
  quantity: number;
  total: number;
  dueDate: string | null;
  weeklyScheduleDay: string | null;
  overallProductionStatus: string;
  createdAt: string;
};

const scheduleColumns = [
  { key: "UNSCHEDULED", label: "Unscheduled Orders" },
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
] as const;

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  status: string;
  priority: string;
  quantity: number;
  total: unknown;
  dueDate: Date | null;
  weeklyScheduleDay: string | null;
  overallProductionStatus: string;
  createdAt: Date;
}): ScheduledOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    poNumber: order.poNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    priority: order.priority,
    quantity: order.quantity,
    total: Number(order.total || 0),
    dueDate: order.dueDate ? order.dueDate.toISOString() : null,
    weeklyScheduleDay: order.weeklyScheduleDay,
    overallProductionStatus: order.overallProductionStatus,
    createdAt: order.createdAt.toISOString(),
  };
}

export default async function AdminSchedulePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  const orders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ["COMPLETED", "CANCELLED"],
      },
    },
    orderBy: [{ weeklyScheduleDay: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      orderNumber: true,
      poNumber: true,
      customerName: true,
      customerEmail: true,
      status: true,
      priority: true,
      quantity: true,
      total: true,
      dueDate: true,
      weeklyScheduleDay: true,
      overallProductionStatus: true,
      createdAt: true,
    },
  });

  const scheduledOrders = orders.map(serializeOrder);

  const columns = scheduleColumns.map((column) => ({
    ...column,
    orders: scheduledOrders.filter((order) => {
      if (column.key === "UNSCHEDULED") {
        return !order.weeklyScheduleDay;
      }

      return order.weeklyScheduleDay === column.key;
    }),
  }));

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Weekly Schedule
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl">
                Weekly Order Priority Board
              </h1>

              <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                Drag active orders into Monday through Sunday buckets so the
                team knows which orders to prioritize each day. Completed and
                cancelled orders are automatically hidden from this board.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/orders" className="button-secondary">
                Orders
              </Link>
              <Link href="/admin/kanban" className="button-secondary">
                Kanban
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{scheduledOrders.length}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Unscheduled
            </p>
            <p className="mt-3 text-4xl font-bold">
              {columns.find((column) => column.key === "UNSCHEDULED")?.orders
                .length || 0}
            </p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Scheduled
            </p>
            <p className="mt-3 text-4xl font-bold">
              {scheduledOrders.filter((order) => order.weeklyScheduleDay).length}
            </p>
          </div>
        </section>

        <section className="mt-8 section-card-strong">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Monday - Sunday Buckets
            </p>
            <h2 className="mt-2 text-3xl font-bold">Schedule Board</h2>
          </div>

          <ScheduleBoard columns={columns} />
        </section>
      </div>
    </main>
  );
}