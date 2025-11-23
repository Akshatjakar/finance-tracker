import { defineConfig } from "@prisma/config";

export default defineConfig({
  earlyAccess: true,         // <-- **add this**
  schema: "./prisma/schema.prisma",
  // Remove datasource here if you're using PrismaClient for URL
});
