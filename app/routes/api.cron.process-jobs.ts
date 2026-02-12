import type { LoaderFunctionArgs } from "@remix-run/node";
import { processNextJob } from "~/services/job-queue.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Process up to 10 jobs in a loop
  let processed = 0;
  let errors = 0;
  const maxJobs = 10;

  for (let i = 0; i < maxJobs; i++) {
    const result = await processNextJob();
    if (!result.processed) break; // No more pending jobs
    processed++;
    if (result.error) errors++;
  }

  console.log(`[Cron] Processed ${processed} jobs (${errors} errors)`);

  return new Response(
    JSON.stringify({
      processed,
      errors,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
