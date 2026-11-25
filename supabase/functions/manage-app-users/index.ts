import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!url || !anonKey || !serviceKey || !token) return respond({ error: "Konfigurasi autentikasi server tidak lengkap." }, 500);

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user || authData.user.email?.toLowerCase() !== "admin@ytmsewu.com") {
      return respond({ error: "Akses ditolak. Hanya admin yang dapat mengelola pengguna." }, 403);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const users = (data.users || []).map((user) => ({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.user_metadata?.name || "",
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        banned_until: user.banned_until,
      }));
      return respond({ users });
    }

    if (action === "list_accounts") {
      const { data: accounts, error } = await admin
        .from("yt_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ownerIds = [...new Set((accounts || []).map((account) => account.user_id).filter(Boolean))];
      const owners = await Promise.all(ownerIds.map(async (id) => {
        const { data, error: ownerError } = await admin.auth.admin.getUserById(id);
        if (ownerError) {
          console.error("Gagal mengambil pemilik akun:", id, ownerError);
          return [id, { email: "", display_name: "" }];
        }
        return [id, {
          email: data.user?.email || "",
          display_name: data.user?.user_metadata?.display_name || data.user?.user_metadata?.name || "",
        }];
      }));
      const ownerMap = new Map(owners);
      return respond({
        accounts: (accounts || []).map((account) => ({
          ...account,
          owner_email: ownerMap.get(account.user_id)?.email || "",
          owner_name: ownerMap.get(account.user_id)?.display_name || "",
        })),
      });
    }

    const userId = String(body.user_id || "");
    if (action !== "invite") {
      if (!userId) return respond({ error: "ID pengguna wajib diisi." }, 400);
      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !targetData.user) return respond({ error: "Pengguna tidak ditemukan." }, 404);
      if (targetData.user.email?.toLowerCase() === "admin@ytmsewu.com") {
        return respond({ error: "Akun admin utama dilindungi dan tidak dapat diubah, diblokir, atau dihapus." }, 403);
      }
    }

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const displayName = String(body.display_name || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Alamat email tidak valid." }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: displayName },
      });
      if (error) throw error;
      return respond({ user: { id: data.user?.id, email: data.user?.email }, message: "Invitation sent." });
    }

    if (action === "update") {
      const email = String(body.email || "").trim().toLowerCase();
      const displayName = String(body.display_name || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Alamat email tidak valid." }, 400);
      const password = typeof body.password === "string" ? body.password : "";
      if (password && password.length < 8) return respond({ error: "Password minimal 8 karakter." }, 400);
      const { data: existing } = await admin.auth.admin.getUserById(userId);
      const updates: Record<string, unknown> = {
        email,
        user_metadata: { ...(existing.user?.user_metadata || {}), display_name: displayName },
      };
      if (password) updates.password = password;
      const { data, error } = await admin.auth.admin.updateUserById(userId, updates);
      if (error) throw error;
      return respond({ user: { id: data.user.id, email: data.user.email } });
    }

    if (action === "block" || action === "unblock") {
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: action === "block" ? "876000h" : "none",
      });
      if (error) throw error;
      return respond({ user: { id: data.user.id, email: data.user.email, banned_until: data.user.banned_until } });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("manage-app-users:", error);
    return respond({ error: error instanceof Error ? error.message : "Terjadi kesalahan server." }, 400);
  }
});
