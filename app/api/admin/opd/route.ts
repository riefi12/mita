import { isAdminRequest } from "@/lib/admin-auth";
import {
  addOpdFeed,
  deleteOpdFeed,
  readOpdFeeds,
  setOpdFeedEnabled,
  updateOpdFeed,
  validateFeedUrl,
  validateWebsiteUrl,
} from "@/lib/opd-feeds";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Silakan masuk sebagai admin terlebih dahulu." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    return Response.json({ feeds: await readOpdFeeds() });
  } catch (error) {
    console.error("Gagal membaca registry feed OPD:", error);
    return Response.json({ error: "Daftar feed OPD tidak dapat dibaca." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body = (await request.json()) as {
      name?: unknown;
      websiteUrl?: unknown;
      feedUrl?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const websiteUrl = validateWebsiteUrl(body.websiteUrl);
    const feedUrl = validateFeedUrl(body.feedUrl);
    if (!name || name.length > 150) {
      return Response.json({ error: "Nama OPD wajib diisi (maksimal 150 karakter)." }, { status: 400 });
    }
    if (!websiteUrl) {
      return Response.json(
        { error: "Website OPD wajib HTTPS dan berada di acehbaratkab.go.id atau subdomain-nya." },
        { status: 400 },
      );
    }
    if (!feedUrl) {
      return Response.json(
        { error: "URL wajib HTTPS dan berada di acehbaratkab.go.id atau subdomain-nya." },
        { status: 400 },
      );
    }

    const feed = await addOpdFeed({ name, websiteUrl, feedUrl });
    return Response.json({ feed }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_FEED") {
      return Response.json({ error: "URL feed tersebut sudah terdaftar untuk OPD ini." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "OPD_NAME_OR_WEBSITE_CONFLICT") {
      return Response.json(
        { error: "Nama OPD atau website sudah digunakan oleh OPD lain." },
        { status: 409 },
      );
    }
    console.error("Gagal menambahkan feed OPD:", error);
    return Response.json({ error: "Feed OPD tidak dapat disimpan." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body = (await request.json()) as {
      id?: unknown;
      enabled?: unknown;
      name?: unknown;
      websiteUrl?: unknown;
      feedUrl?: unknown;
    };
    if (typeof body.id !== "string") {
      return Response.json({ error: "ID feed wajib diisi." }, { status: 400 });
    }

    if (typeof body.enabled === "boolean") {
      const feed = await setOpdFeedEnabled(body.id, body.enabled);
      if (!feed) return Response.json({ error: "Feed tidak ditemukan." }, { status: 404 });
      return Response.json({ feed });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const websiteUrl = validateWebsiteUrl(body.websiteUrl);
    const feedUrl = validateFeedUrl(body.feedUrl);
    if (!name || name.length > 150) {
      return Response.json({ error: "Nama OPD wajib diisi (maksimal 150 karakter)." }, { status: 400 });
    }
    if (!websiteUrl) {
      return Response.json(
        { error: "Website OPD wajib HTTPS dan berada di acehbaratkab.go.id atau subdomain-nya." },
        { status: 400 },
      );
    }
    if (!feedUrl) {
      return Response.json(
        { error: "URL wajib HTTPS dan berada di acehbaratkab.go.id atau subdomain-nya." },
        { status: 400 },
      );
    }

    const feed = await updateOpdFeed(body.id, { name, websiteUrl, feedUrl });
    if (!feed) return Response.json({ error: "Feed tidak ditemukan." }, { status: 404 });
    return Response.json({ feed });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_FEED") {
      return Response.json({ error: "URL feed tersebut sudah terdaftar untuk OPD ini." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "OPD_NAME_OR_WEBSITE_CONFLICT") {
      return Response.json(
        { error: "Nama OPD atau website sudah digunakan oleh OPD lain." },
        { status: 409 },
      );
    }
    console.error("Gagal memperbarui feed OPD:", error);
    return Response.json({ error: "Feed OPD tidak dapat diperbarui." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id !== "string") {
      return Response.json({ error: "ID OPD wajib diisi." }, { status: 400 });
    }

    if (!(await deleteOpdFeed(body.id))) {
      return Response.json({ error: "Feed tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ feeds: await readOpdFeeds() });
  } catch (error) {
    console.error("Gagal menghapus feed OPD:", error);
    return Response.json({ error: "Feed OPD tidak dapat dihapus." }, { status: 500 });
  }
}
