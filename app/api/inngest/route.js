import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

export const { GET, POST } = serve({
  client: inngest,
  functions: async () => {
    const mod = await import("@/lib/inngest/function");

    return [
      mod.processRecurringTransaction,
      mod.triggerRecurringTransactions,
      mod.generateMonthlyReports,
      mod.checkBudgetAlerts,
    ];
  },
});