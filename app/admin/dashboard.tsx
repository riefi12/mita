"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type OpdFeed = {
  id: string;
  opdId: string;
  name: string;
  websiteUrl: string;
  feedUrl: string;
  enabled: boolean;
  createdAt: string;
};

type ApiError = { error?: string };

export default function AdminDashboard() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feeds, setFeeds] = useState<OpdFeed[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editFeedUrl, setEditFeedUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const loadFeeds = useCallback(async () => {
    const response = await fetch("/api/admin/opd", { cache: "no-store" });
    const data = (await response.json()) as { feeds?: OpdFeed[] } & ApiError;
    if (!response.ok) throw new Error(data.error ?? "Daftar OPD tidak dapat dimuat.");
    setFeeds(data.feeds ?? []);
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const session = (await response.json()) as { authenticated: boolean; configured: boolean };
        setConfigured(session.configured);
        setAuthenticated(session.authenticated);
        if (session.authenticated) await loadFeeds();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Dashboard admin tidak dapat dimuat.");
      } finally {
        setLoading(false);
      }
    }
    void initialize();
  }, [loadFeeds]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as ApiError;
      if (!response.ok) throw new Error(data.error ?? "Login admin gagal.");
      setPassword("");
      setAuthenticated(true);
      await loadFeeds();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login admin gagal.");
    } finally {
      setSaving(false);
    }
  }

  async function addFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/opd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, websiteUrl, feedUrl }),
      });
      const data = (await response.json()) as { feed?: OpdFeed } & ApiError;
      if (!response.ok) throw new Error(data.error ?? "Feed OPD tidak dapat ditambahkan.");
      if (data.feed) setFeeds((current) => [...current, data.feed!]);
      setName("");
      setWebsiteUrl("");
      setFeedUrl("");
      setNotice("Feed berhasil ditambahkan dan akan masuk ke berita Mita.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feed OPD tidak dapat ditambahkan.");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(feed: OpdFeed, enabled: boolean) {
    setError("");
    setNotice("");
    setBusyId(feed.id);
    try {
      const response = await fetch("/api/admin/opd", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: feed.id, enabled }),
      });
      const data = (await response.json()) as { feed?: OpdFeed } & ApiError;
      if (!response.ok || !data.feed) throw new Error(data.error ?? "Status feed tidak dapat diperbarui.");
      setFeeds((current) => current.map((item) => (item.id === feed.id ? data.feed! : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status feed tidak dapat diperbarui.");
    } finally {
      setBusyId("");
    }
  }

  function startEditing(feed: OpdFeed) {
    setError("");
    setNotice("");
    setEditingId(feed.id);
    setEditName(feed.name);
    setEditWebsiteUrl(feed.websiteUrl);
    setEditFeedUrl(feed.feedUrl);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, feed: OpdFeed) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyId(feed.id);
    try {
      const response = await fetch("/api/admin/opd", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: feed.id,
          name: editName,
          websiteUrl: editWebsiteUrl,
          feedUrl: editFeedUrl,
        }),
      });
      const data = (await response.json()) as { feed?: OpdFeed } & ApiError;
      if (!response.ok || !data.feed) throw new Error(data.error ?? "Perubahan OPD tidak dapat disimpan.");
      setFeeds((current) =>
        current.map((item) => ({
          ...item,
          ...(item.opdId === data.feed!.opdId
            ? { name: data.feed!.name, websiteUrl: data.feed!.websiteUrl }
            : {}),
          ...(item.id === data.feed!.id ? { feedUrl: data.feed!.feedUrl } : {}),
        })),
      );
      setEditingId("");
      setNotice("Nama OPD dan alamat sumber berhasil diperbarui.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Perubahan OPD tidak dapat disimpan.");
    } finally {
      setBusyId("");
    }
  }

  async function removeFeed(feed: OpdFeed) {
    if (!window.confirm(`Hapus sumber feed ${feed.name}?`)) return;
    setError("");
    setNotice("");
    setBusyId(feed.id);
    try {
      const response = await fetch("/api/admin/opd", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: feed.id }),
      });
      const data = (await response.json()) as { feeds?: OpdFeed[] } & ApiError;
      if (!response.ok || !data.feeds) throw new Error(data.error ?? "Feed OPD tidak dapat dihapus.");
      setFeeds(data.feeds);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feed OPD tidak dapat dihapus.");
    } finally {
      setBusyId("");
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setFeeds([]);
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/" aria-label="Mita, kembali ke beranda">
          <span className="brand-seal">M</span>
          <span className="brand-name">mi<span>ta</span></span>
        </Link>
        <Link className="admin-back-link" href="/">← KEMBALI KE BERITA</Link>
      </header>

      <section className="admin-intro">
        <p className="admin-eyebrow">PUSAT KENDALI · ACEH BARAT</p>
        <h1>Direktori <em>OPD.</em></h1>
        <p>Tambahkan sitemap XML atau RSS resmi agar berita dari setiap perangkat daerah tampil bersama di Mita.</p>
      </section>

      {error && <div className="admin-alert" role="alert">{error}</div>}
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {loading ? (
        <div className="admin-panel admin-loading">Memeriksa sesi admin…</div>
      ) : !configured ? (
        <section className="admin-panel admin-setup">
          <span className="admin-panel-label">KONFIGURASI DIPERLUKAN</span>
          <h2>Aktifkan akses admin</h2>
          <p>Atur <code>MITA_ADMIN_PASSWORD</code> dan <code>MITA_ADMIN_SESSION_SECRET</code> pada environment server, lalu mulai ulang aplikasi.</p>
          <Link href="/" className="admin-secondary-button">Kembali ke Mita</Link>
        </section>
      ) : !authenticated ? (
        <form className="admin-panel admin-login" onSubmit={signIn}>
          <span className="admin-panel-label">AKSES TERBATAS</span>
          <h2>Masuk sebagai admin</h2>
          <label htmlFor="admin-password">Kata sandi admin</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="admin-primary-button" type="submit" disabled={saving}>
            {saving ? "Memeriksa…" : "Masuk ke dashboard"}
          </button>
        </form>
      ) : (
        <>
          <section className="admin-summary">
            <div><span>FEED TERDAFTAR</span><strong>{feeds.length.toString().padStart(2, "0")}</strong></div>
            <div><span>FEED AKTIF</span><strong>{feeds.filter((feed) => feed.enabled).length.toString().padStart(2, "0")}</strong></div>
            <button className="admin-secondary-button" onClick={() => void signOut()}>Keluar</button>
          </section>

          <section className="admin-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-panel-label">SUMBER BARU</span>
                <h2>Tambahkan sumber feed</h2>
              </div>
              <span className="admin-section-number">01</span>
            </div>
            <form className="admin-feed-form" onSubmit={addFeed}>
              <label>
                Nama perangkat daerah
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Dinas Kesehatan"
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Link website OPD
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://dinkes.acehbaratkab.go.id"
                  required
                />
              </label>
              <label>
                URL sumber sitemap XML atau RSS/Atom
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(event) => setFeedUrl(event.target.value)}
                  placeholder="https://dinkes.acehbaratkab.go.id/sitemap.xml"
                  required
                />
              </label>
              <p className="admin-form-hint">Gunakan URL sitemap XML untuk menghimpun banyak berita, atau RSS/Atom bila sitemap tidak tersedia. URL harus HTTPS pada domain <code>acehbaratkab.go.id</code> atau subdomain resminya.</p>
              <button className="admin-primary-button" type="submit" disabled={saving}>
                {saving ? "Menyimpan…" : "Tambahkan sumber"}
              </button>
            </form>
          </section>

          <section className="admin-panel admin-registry">
            <div className="admin-section-heading">
              <div>
                <span className="admin-panel-label">DAFTAR TERKELOLA</span>
                <h2>Sumber berita OPD</h2>
              </div>
              <span className="admin-section-number">02</span>
            </div>
            {feeds.length === 0 ? (
              <div className="admin-empty">
                <strong>Belum ada feed OPD tambahan.</strong>
                <span>Feed resmi Pemkab Aceh Barat tetap aktif.</span>
              </div>
            ) : (
              <div className="admin-feed-list">
                {feeds.map((feed) => (
                  <article className="admin-feed-row" key={feed.id}>
                    {editingId === feed.id ? (
                      <form className="admin-edit-form" onSubmit={(event) => void saveEdit(event, feed)}>
                        <strong>Ubah detail OPD dan feed</strong>
                        <label>
                          Nama perangkat daerah
                          <input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={150} required />
                        </label>
                        <label>
                          Link website OPD
                          <input type="url" value={editWebsiteUrl} onChange={(event) => setEditWebsiteUrl(event.target.value)} required />
                        </label>
                        <label>
                          URL sumber sitemap XML atau RSS/Atom
                          <input type="url" value={editFeedUrl} onChange={(event) => setEditFeedUrl(event.target.value)} required />
                        </label>
                        <div className="admin-edit-actions">
                          <button className="admin-primary-button" type="submit" disabled={busyId === feed.id}>
                            {busyId === feed.id ? "Menyimpan…" : "Simpan perubahan"}
                          </button>
                          <button className="admin-secondary-button" type="button" onClick={() => setEditingId("")} disabled={busyId === feed.id}>
                            Batal
                          </button>
                        </div>
                        <p className="admin-form-hint">Alamat website dan sitemap/RSS harus HTTPS pada domain <code>acehbaratkab.go.id</code> atau subdomain resminya.</p>
                      </form>
                    ) : (
                      <>
                        <div className="admin-feed-info">
                          <div className="admin-feed-title">
                            <span className={feed.enabled ? "admin-status-dot" : "admin-status-dot disabled"} />
                            <h3>{feed.name}</h3>
                            <span className={feed.enabled ? "admin-status enabled" : "admin-status"}>
                              {feed.enabled ? "AKTIF" : "NONAKTIF"}
                            </span>
                          </div>
                          <a href={feed.websiteUrl} target="_blank" rel="noreferrer">Website: {feed.websiteUrl} ↗</a>
                          <a href={feed.feedUrl} target="_blank" rel="noreferrer">Sitemap/RSS: {feed.feedUrl} ↗</a>
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-text-button" onClick={() => startEditing(feed)} disabled={busyId === feed.id}>
                            Ubah
                          </button>
                          <button
                            className="admin-text-button"
                            onClick={() => void setEnabled(feed, !feed.enabled)}
                            disabled={busyId === feed.id}
                          >
                            {feed.enabled ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            className="admin-delete-button"
                            onClick={() => void removeFeed(feed)}
                            disabled={busyId === feed.id}
                          >
                            Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <footer className="admin-footer">
        <span>MITA · DIREKTORI SUMBER RESMI</span>
        <span>PERUBAHAN BERLAKU PADA PEMUATAN BERITA BERIKUTNYA</span>
      </footer>
    </main>
  );
}
