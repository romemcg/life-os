import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

/** The current build id, so open tabs can tell when a new version was installed. */
export function GET() {
  let id = "dev";
  try {
    id = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {}
  return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
