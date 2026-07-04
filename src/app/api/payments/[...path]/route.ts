import { createRouteHandlers } from "@/server/lib/route-handler-factory";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const router = require("../../../../server/payments/routes.js");

export const { GET, POST, PUT, DELETE, PATCH } = createRouteHandlers(router, "payments");
