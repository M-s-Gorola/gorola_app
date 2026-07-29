import { PrismaClient } from "@prisma/client";

import { decryptPII, encryptPII, hashPII } from "./crypto.js";

let prismaSingleton: unknown = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaSingleton) {
    const baseClient = new PrismaClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformWhere = (where: any) => {
      if (
        where?.phone &&
        typeof where.phone === "string" &&
        !where.phone.startsWith("enc:")
      ) {
        const rawPhone = where.phone;
        const piiHash = hashPII(rawPhone);
        const encPhone = encryptPII(rawPhone);
        delete where.phone;
        where.OR = [
          { phoneHash: piiHash },
          { phone: rawPhone },
          { phone: encPhone }
        ];
      }
    };

    prismaSingleton = baseClient.$extends({
      query: {
        user: {
          async findUnique({ args, query }) {
            if (
              args.where?.phone &&
              typeof args.where.phone === "string" &&
              !args.where.phone.startsWith("enc:")
            ) {
              const rawPhone = args.where.phone;
              const piiHash = hashPII(rawPhone);
              const encPhone = encryptPII(rawPhone);
              const user = await baseClient.user.findFirst({
                where: {
                  OR: [
                    { phoneHash: piiHash },
                    { phone: rawPhone },
                    { phone: encPhone }
                  ]
                }
              });
              if (user && user.phone) {
                user.phone = decryptPII(user.phone);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return user as any;
            }
            const res = await query(args);
            if (res && res.phone) {
              res.phone = decryptPII(res.phone);
            }
            return res;
          },
          async findUniqueOrThrow({ args, query }) {
            if (
              args.where?.phone &&
              typeof args.where.phone === "string" &&
              !args.where.phone.startsWith("enc:")
            ) {
              const rawPhone = args.where.phone;
              const piiHash = hashPII(rawPhone);
              const encPhone = encryptPII(rawPhone);
              const user = await baseClient.user.findFirst({
                where: {
                  OR: [
                    { phoneHash: piiHash },
                    { phone: rawPhone },
                    { phone: encPhone }
                  ]
                }
              });
              if (!user) {
                throw new Error("No record was found for a query.");
              }
              if (user.phone) {
                user.phone = decryptPII(user.phone);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return user as any;
            }
            const res = await query(args);
            if (res && res.phone) {
              res.phone = decryptPII(res.phone);
            }
            return res;
          },
          async findFirst({ args, query }) {
            transformWhere(args.where);
            const res = await query(args);
            if (res && res.phone) {
              res.phone = decryptPII(res.phone);
            }
            return res;
          },
          async findMany({ args, query }) {
            transformWhere(args.where);
            const res = await query(args);
            if (Array.isArray(res)) {
              for (const item of res) {
                if (item && item.phone) {
                  item.phone = decryptPII(item.phone);
                }
              }
            }
            return res;
          },
          async count({ args, query }) {
            transformWhere(args.where);
            return query(args);
          },
          async upsert({ args, query }) {
            if (
              args.where?.phone &&
              typeof args.where.phone === "string" &&
              !args.where.phone.startsWith("enc:")
            ) {
              const rawPhone = args.where.phone;
              const piiHash = hashPII(rawPhone);
              delete args.where.phone;
              args.where.phoneHash = piiHash;
            }
            if (
              args.create?.phone &&
              typeof args.create.phone === "string" &&
              !args.create.phone.startsWith("enc:")
            ) {
              args.create.phoneHash = hashPII(args.create.phone);
              args.create.phone = encryptPII(args.create.phone);
            }
            if (
              args.update?.phone &&
              typeof args.update.phone === "string" &&
              !args.update.phone.startsWith("enc:")
            ) {
              args.update.phoneHash = hashPII(args.update.phone);
              args.update.phone = encryptPII(args.update.phone);
            }
            const res = await query(args);
            if (res && res.phone) {
              res.phone = decryptPII(res.phone);
            }
            return res;
          },
          async create({ args, query }) {
            if (
              args.data?.phone &&
              typeof args.data.phone === "string" &&
              !args.data.phone.startsWith("enc:")
            ) {
              args.data.phoneHash = hashPII(args.data.phone);
              args.data.phone = encryptPII(args.data.phone);
            }
            const res = await query(args);
            if (res && res.phone) {
              res.phone = decryptPII(res.phone);
            }
            return res;
          },
          async deleteMany({ args, query }) {
            transformWhere(args.where);
            return query(args);
          },
          async updateMany({ args, query }) {
            transformWhere(args.where);
            if (
              args.data?.phone &&
              typeof args.data.phone === "string" &&
              !args.data.phone.startsWith("enc:")
            ) {
              args.data.phoneHash = hashPII(args.data.phone);
              args.data.phone = encryptPII(args.data.phone);
            }
            return query(args);
          }
        }
      }
    });
  }
  return prismaSingleton as PrismaClient;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaSingleton) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prismaSingleton as any).$disconnect?.();
    prismaSingleton = null;
  }
}
