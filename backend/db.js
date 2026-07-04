const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.includes("connection_limit")
          ? process.env.DATABASE_URL
          : process.env.DATABASE_URL + "?connection_limit=10&pool_timeout=30"
        : process.env.DATABASE_URL,
    },
  },
});

module.exports = prisma;