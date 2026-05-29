import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// ── Import directly at top level — no async needed ──
import {
  processRecurringTransaction,
  triggerRecurringTransactions,
  generateMonthlyReports,
  checkBudgetAlerts,
} from "@/lib/inngest/function";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processRecurringTransaction,
    triggerRecurringTransactions,
    generateMonthlyReports,
    checkBudgetAlerts,
  ],
});