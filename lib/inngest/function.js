import { serve } from "inngest/next";
import { inngest } from "./client";
import { db } from "@/lib/prisma";
import EmailTemplate from "@/emails/template";
import { sendEmail } from "@/actions/send-email";

export const runtime = "nodejs";

/* -----------------------------
   1. Recurring Transaction
------------------------------*/
export const processRecurringTransaction =
  inngest.createFunction(
    {
      id: "process-recurring-transaction",
      name: "Process Recurring Transaction",
    },
    { event: "transaction.recurring.process" },
    async ({ event, step }) => {
      if (
        !event?.data?.transactionId ||
        !event?.data?.userId
      ) {
        return { error: "Invalid event data" };
      }

      await step.run("process", async () => {
        const transaction =
          await db.transaction.findUnique({
            where: {
              id: event.data.transactionId,
              userId: event.data.userId,
            },
          });

        if (!transaction) return;

        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await db.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              type: transaction.type,
              amount: transaction.amount,
              description:
                transaction.description +
                " (Recurring)",
              date: new Date(),
              category: transaction.category,
              userId: transaction.userId,
              accountId: transaction.accountId,
              isRecurring: false,
            },
          });

          await tx.account.update({
            where: { id: transaction.accountId },
            data: {
              balance: {
                increment: balanceChange,
              },
            },
          });

          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              lastProcessed: new Date(),
              nextRecurringDate:
                calculateNextRecurringDate(
                  new Date(),
                  transaction.recurringInterval
                ),
            },
          });
        });
      });
    }
  );

/* -----------------------------
   2. Trigger Recurring
------------------------------*/
export const triggerRecurringTransactions =
  inngest.createFunction(
    {
      id: "trigger-recurring-transactions",
      name: "Trigger Recurring Transactions",
    },
    { cron: "0 0 * * *" },
    async ({ step }) => {
      const transactions = await step.run(
        "fetch",
        async () => {
          return db.transaction.findMany({
            where: {
              isRecurring: true,
              status: "COMPLETED",
            },
          });
        }
      );

      const events = transactions.map((t) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: t.id,
          userId: t.userId,
        },
      }));

      if (events.length > 0) {
        await inngest.send(events);
      }

      return { triggered: events.length };
    }
  );

/* -----------------------------
   3. Monthly Reports
------------------------------*/
export const generateMonthlyReports =
  inngest.createFunction(
    {
      id: "generate-monthly-reports",
      name: "Generate Monthly Reports",
    },
    { cron: "0 0 1 * *" },
    async ({ step }) => {
      const users = await step.run("users", async () => {
        return db.user.findMany();
      });

      for (const user of users) {
        await step.run(
          `report-${user.id}`,
          async () => {
            const lastMonth = new Date();
            lastMonth.setMonth(
              lastMonth.getMonth() - 1
            );

            const stats = await getMonthlyStats(
              user.id,
              lastMonth
            );

            const insights =
              await generateFinancialInsights(
                stats,
                lastMonth.toLocaleString("default", {
                  month: "long",
                })
              );

            await sendEmail({
              to: user.email,
              subject: "Monthly Report",
              react: EmailTemplate({
                userName: user.name,
                type: "monthly-report",
                data: { stats, insights },
              }),
            });
          }
        );
      }

      return { users: users.length };
    }
  );

/* -----------------------------
   4. Budget Alerts
------------------------------*/
export const checkBudgetAlerts =
  inngest.createFunction(
    {
      id: "check-budget-alerts",
      name: "Check Budget Alerts",
    },
    { cron: "0 */6 * * *" },
    async ({ step }) => {
      const budgets = await step.run(
        "fetch",
        async () => db.budget.findMany()
      );

      for (const budget of budgets) {
        await step.run(
          `budget-${budget.id}`,
          async () => {
            const start = new Date();
            start.setDate(1);

            const expenses =
              await db.transaction.aggregate({
                where: {
                  userId: budget.userId,
                  type: "EXPENSE",
                  date: { gte: start },
                },
                _sum: { amount: true },
              });

            const total =
              expenses._sum.amount?.toNumber() ||
              0;

            const percent =
              (total / budget.amount) * 100;

            if (percent >= 80) {
              await sendEmail({
                to: budget.user.email,
                subject: "Budget Alert",
                react: EmailTemplate({
                  userName: budget.user.name,
                  type: "budget-alert",
                  data: {
                    percent,
                    total,
                    budget: budget.amount,
                  },
                }),
              });
            }
          }
        );
      }
    }
  );

/* -----------------------------
   HELPERS
------------------------------*/
async function generateFinancialInsights(
  stats,
  month
) {
  const { GoogleGenerativeAI } = await import(
    "@google/generative-ai"
  );

  const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
  );

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const prompt = `
Analyze financial data for ${month}.
Return 3 insights in JSON array.
`;

  try {
    const result =
      await model.generateContent(prompt);

    const text = result.response.text();

    return JSON.parse(
      text.replace(/```json|```/g, "").trim()
    );
  } catch {
    return [
      "Track expenses carefully.",
      "Reduce unnecessary spending.",
      "Plan monthly budget better.",
    ];
  }
}

function calculateNextRecurringDate(
  date,
  interval
) {
  const d = new Date(date);

  switch (interval) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }

  return d;
}

async function getMonthlyStats(
  userId,
  month
) {
  const start = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  );

  const end = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  );

  const transactions =
    await db.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    });

  return transactions.reduce(
    (acc, t) => {
      const amt = t.amount.toNumber();

      if (t.type === "EXPENSE") {
        acc.totalExpenses += amt;
      } else {
        acc.totalIncome += amt;
      }

      return acc;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      transactionCount: transactions.length,
    }
  );
}