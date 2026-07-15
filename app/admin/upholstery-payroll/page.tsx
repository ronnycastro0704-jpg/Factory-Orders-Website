import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import FrameRateTable from "./frame-rate-table";
import PayrollWeekBoard from "./payroll-week-board";

type PageProps = {
  searchParams: Promise<{
    employee?: string;
    weekStart?: string;
  }>;
};

type FrameChoiceRow = {
  productId: string;
  optionChoiceId: string;
  productName: string;
  frameName: string;
  frameImageUrl: string | null;
  rate: number;
};

function getTodayDateInputValue() {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseWeekStartForQuery(value: string) {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export default async function UpholsteryPayrollPage({
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/my/orders");
  }

  const params = await searchParams;

  const selectedEmployeeName = String(params.employee || "").trim();
  const selectedWeekStart =
    String(params.weekStart || "").trim() || getTodayDateInputValue();

  const selectedWeekStartDate = parseWeekStartForQuery(selectedWeekStart);

  const [products, savedFrameRates, upholsteryEmployees, payrollEntries] =
    await Promise.all([
      prisma.product.findMany({
        where: {
          active: true,
        },
        orderBy: {
          name: "asc",
        },
        include: {
          optionGroups: {
            where: {
              active: true,
            },
            orderBy: {
              displayOrder: "asc",
            },
            include: {
              choices: {
                where: {
                  active: true,
                },
                orderBy: {
                  displayOrder: "asc",
                },
              },
            },
          },
        },
      }),
      prisma.upholsteryFrameRate.findMany({
        where: {
          active: true,
        },
      }),
      prisma.employee.findMany({
        where: {
          active: true,
          department: "UPHOLSTERY",
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      }),
      selectedEmployeeName && selectedWeekStartDate
        ? prisma.upholsteryPayrollEntry.findMany({
            where: {
              employeeName: selectedEmployeeName,
              weekStart: selectedWeekStartDate,
            },
            orderBy: [{ checked: "desc" }, { orderNumber: "asc" }],
          })
        : [],
    ]);

  const savedFrameRateMap = new Map(
    savedFrameRates.map((rate) => [
      `${rate.productId}|||${rate.optionChoiceId}`,
      Number(rate.rate || 0),
    ])
  );

  const frameRows: FrameChoiceRow[] = products.flatMap((product) => {
    const frameGroup = product.optionGroups[0];

    if (!frameGroup) {
      return [];
    }

    return frameGroup.choices.map((choice) => {
      const frameName = choice.frameNeededCode || choice.label;
      const rate =
        savedFrameRateMap.get(`${product.id}|||${choice.id}`) ?? 0;

      return {
        productId: product.id,
        optionChoiceId: choice.id,
        productName: product.name,
        frameName,
        frameImageUrl: choice.imageUrl,
        rate,
      };
    });
  });

  const payrollRows = payrollEntries.map((entry) => ({
    id: entry.id,
    orderNumber: entry.orderNumber,
    poNumber: entry.poNumber,
    customerName: entry.customerName,
    productName: entry.productName,
    partNumber: entry.partNumber,
    frameName: entry.frameName,
    frameImageUrl: entry.frameImageUrl,
    quantity: entry.quantity,
    rate: Number(entry.rate || 0),
    total: Number(entry.total || 0),
    checked: entry.checked,
  }));

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell space-y-8">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Upholstery Payroll
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl">
                Weekly Upholstery Payroll
              </h1>

              <p className="mt-4 max-w-3xl text-base text-slate-600 sm:text-lg">
                Set a payroll rate for each frame, generate weekly payroll rows
                from completed upholstery work, check the rows against the
                employee paper sheet, and print payroll totals.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/employees" className="button-secondary">
                Employees
              </Link>
              <Link href="/admin/production" className="button-secondary">
                Production
              </Link>
            </div>
          </div>
        </section>

        <section className="section-card-strong">
          <div className="mb-5">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Frame Rates
            </p>
            <h2 className="mt-2 text-3xl font-bold">Pay rate by frame</h2>
            <p className="mt-2 text-sm text-slate-500">
              This uses the first option group from each active product as the
              frame list.
            </p>
          </div>

          <FrameRateTable rows={frameRows} />
        </section>

        <section className="section-card-strong">
          <div className="mb-5">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Weekly Verification
            </p>
            <h2 className="mt-2 text-3xl font-bold">Employee payroll week</h2>
            <p className="mt-2 text-sm text-slate-500">
              Generate rows, then check only the frames confirmed by the
              employee paperwork.
            </p>
          </div>

          <PayrollWeekBoard
            employees={upholsteryEmployees}
            selectedEmployeeName={selectedEmployeeName}
            selectedWeekStart={selectedWeekStart}
            entries={payrollRows}
          />
        </section>
      </div>
    </main>
  );
}