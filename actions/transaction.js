
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

// OpenRouter Client
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

// Create Transaction
export async function createTransaction(data) {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const req = await request();

    const decision = await aj.protect(req, {
      userId,
      requested: 1,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    const balanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const newBalance =
      account.balance.toNumber() + balanceChange;

    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,

          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(
                  data.date,
                  data.recurringInterval
                )
              : null,
        },
      });

      await tx.account.update({
        where: {
          id: data.accountId,
        },

        data: {
          balance: newBalance,
        },
      });

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return {
      success: true,
      data: serializeAmount(transaction),
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get Single Transaction
export async function getTransaction(id) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  return serializeAmount(transaction);
}

// Update Transaction
export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const originalTransaction =
      await db.transaction.findUnique({
        where: {
          id,
          userId: user.id,
        },

        include: {
          account: true,
        },
      });

    if (!originalTransaction) {
      throw new Error("Transaction not found");
    }

    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE"
        ? -data.amount
        : data.amount;

    const netBalanceChange =
      newBalanceChange - oldBalanceChange;

    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },

        data: {
          ...data,

          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(
                  data.date,
                  data.recurringInterval
                )
              : null,
        },
      });

      await tx.account.update({
        where: {
          id: data.accountId,
        },

        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return {
      success: true,
      data: serializeAmount(transaction),
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions =
      await db.transaction.findMany({
        where: {
          userId: user.id,
          ...query,
        },

        include: {
          account: true,
        },

        orderBy: {
          date: "desc",
        },
      });

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Scan Receipt using OpenRouter

export async function scanReceipt(fileData) {
  try {
    const base64Image =
      "data:" +
      fileData.mimeType +
      ";base64," +
      fileData.base64;

    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",

      messages: [
        {
          role: "user",

          content: [
            {
              type: "text",

              text: `
Analyze this receipt image and extract:

- Total amount
- Date
- Description
- Merchant/store name
- Category

Return ONLY valid JSON in this format:

{
  "amount": number,
  "date": "ISO date string",
  "description": "string",
  "merchantName": "string",
  "category": "string"
}

If not a receipt return {}.
              `,
            },

            {
              type: "image_url",

              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
    });

    const text = completion.choices[0].message.content;

    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const data = JSON.parse(cleanedText);

    return {
      success: true,

      data: {
        amount: parseFloat(data.amount) || 0,

        date: data.date
          ? new Date(data.date)
          : new Date(),

        description: data.description || "",

        category:
          data.category || "other-expense",

        merchantName:
          data.merchantName || "",
      },
    };
  } catch (error) {
    console.error("OpenRouter OCR Error:", error);

    return {
      success: false,
      error: "Failed to scan receipt",
    };
  }
}



// Helper Function
function calculateNextRecurringDate(
  startDate,
  interval
) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;

    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;

    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;

    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}

