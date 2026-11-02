import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StoredFile {
  bucket: string;
  path: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isStoredFileList(value: unknown): value is StoredFile[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" && item !== null &&
    typeof (item as StoredFile).bucket === "string" &&
    typeof (item as StoredFile).path === "string"
  );
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "You need to be signed in to delete your account." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "You need to be signed in to delete your account." }, 401);
    }
    const user = userData.user;

    if (user.app_metadata?.community_reviewer === true) {
      return json({
        error: "Administrator accounts cannot be deleted yet. Remove your admin access before deleting this account.",
      }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: files, error: prepareError } = await admin.rpc("prepare_account_deletion", {
      p_user_id: user.id,
    });

    if (prepareError) {
      if (prepareError.message?.includes("OPERATOR_OWNER")) {
        return json({
          error: "This account owns a transport operator. Transfer ownership or close the operator before deleting the account.",
        }, 409);
      }
      console.error("prepare_account_deletion failed", prepareError);
      return json({ error: "We could not delete your account right now. Please try again." }, 500);
    }

    if (!isStoredFileList(files)) {
      console.error("prepare_account_deletion returned an unexpected shape");
      return json({ error: "We could not delete your account right now. Please try again." }, 500);
    }

    const pathsByBucket = new Map<string, string[]>();
    for (const file of files) {
      const paths = pathsByBucket.get(file.bucket) ?? [];
      paths.push(file.path);
      pathsByBucket.set(file.bucket, paths);
    }

    for (const [bucket, paths] of pathsByBucket) {
      for (let start = 0; start < paths.length; start += 100) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths.slice(start, start + 100));
        if (removeError) {
          console.error("storage cleanup failed", bucket, removeError);
          return json({ error: "We could not remove your uploaded files yet. Please try again." }, 500);
        }
      }
    }

    const { error: clearError } = await admin
      .from("account_deletion_pending_files")
      .delete()
      .eq("user_id", user.id);
    if (clearError) {
      console.error("pending file list cleanup failed", clearError);
      return json({ error: "We could not finish removing your uploaded files. Please try again." }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("auth user deletion failed", deleteError);
      return json({
        error: "Your personal data was removed, but the sign-in account could not be deleted yet. Please try again.",
      }, 500);
    }

    return json({ success: true }, 200);
  } catch (cause) {
    console.error("delete-account failed", cause);
    return json({ error: "We could not delete your account right now. Please try again." }, 500);
  }
}

const allowedOrigins = ["https://moryon-ph-6lty.vercel.app", "https://localhost", "http://localhost:5173"];

Deno.serve(async (req: Request) => {
  const response = await handleRequest(req);
  const origin = req.headers.get("Origin");
  const headers = new Headers(response.headers);
  headers.append("Vary", "Origin");
  if (origin && allowedOrigins.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
