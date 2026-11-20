import { cache } from "react";
import { getPulse } from "./pulse";

/** One feed read per request, shared by every section that shows live data. */
export const pulse = cache(getPulse);
