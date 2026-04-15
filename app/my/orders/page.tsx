import Link from "next/link";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";

type OrderItemSummary = {
  id: string;
  productNameSnapshot: string;
};

type MyOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: unknown;
  items: OrderItemSummary[];
};

export default async function MyOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const orders = (await prisma.order.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
    },
  })) as MyOrderRow[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm text-slate-500">My Account</p>
          <h1 className="text-4xl font-bold">My Orders</h1>
          <p className="mt-2 text-slate-600">
            View your submitted orders and any updates.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-slate-500">You do not have any orders yet.</p>
            ) : (
              orders.map((order: MyOrderRow) => (
                <div key={order.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{order.orderNumber}</h2>
                      <p className="text-sm text-slate-500">
                        {order.items[0]?.productNameSnapshot || "No product"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Status: {order.status}
                      </p>
                    </div>

                    <div className="md:text-right">
                      <p className="font-semibold">
                        {formatCurrency(Number(order.total))}
                      </p>
                      <div className="mt-3">
                        <Link
                          href={`/orders/${order.id}/edit`}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                        >
                          Open Order
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}