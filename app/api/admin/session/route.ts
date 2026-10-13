import {
  clearAdminCookie,
  createAdminCookie,
  isAdminConfigured,
  isAdminRequest,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({
    authenticated: isAdminRequest(request),
    configured: isAdminConfigured(),
  });
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return Response.json(
      { error: "Atur MITA_ADMIN_PASSWORD dan MITA_ADMIN_SESSION_SECRET sebelum masuk." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { password?: unknown };
  if (!verifyAdminPassword(body.password)) {
    return Response.json({ error: "Kata sandi admin tidak benar." }, { status: 401 });
  }

  return new Response(JSON.stringify({ authenticated: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": createAdminCookie(),
    },
  });
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearAdminCookie(),
    },
  });
}
