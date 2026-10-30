import { search } from "@/lib/search";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ query: q, results: await search(q) });
});
