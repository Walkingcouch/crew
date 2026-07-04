import { createRouteHandlers } from "@/server/lib/route-handler-factory";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const router = require("../../../../server/lib/push-routes.js");

export const { GET, POST, PUT, DELETE, PATCH } = createRouteHandlers(router, "push");
