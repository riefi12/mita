"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Story = {
  id: string;
  title: string;
  link: string;
  pubDate: string | null;
  excerpt: string;
  categories: string[];
  image: string | null;
  sourceName: string;
  sourceUrl: string;
};

type FeedResponse = {
  items: Story[];
  updatedAt: string;
  source: string;
  sources: { id: string; name: string; url: string }[];
  sourceFailures: { name: string; error: string }[];
};

const BOOKMARKS_KEY = "kabar-barat-bookmarks";

function formatDate(value: string | null) {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("Semua OPD");
  const [view, setView] = useState<"latest" | "saved">("latest");
  const [updatedAt, setUpdatedAt] = useState("");
  const [sourceFailures, setSourceFailures] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/feed", { cache: "no-store" });
      const data = (await response.json()) as FeedResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Feed berita belum dapat dimuat.");
      setStories(data.items);
      setSourceNames(data.sources.map((source) => source.name));
      setUpdatedAt(data.updatedAt);
      setSourceFailures((data.sourceFailures ?? []).map((failure) => failure.name));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Koneksi ke feed terputus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setBookmarks(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]") as string[]);
    } catch {
      setBookmarks([]);
    }
    void loadFeed();
  }, [loadFeed]);

  function toggleBookmark(id: string) {
    const next = bookmarks.includes(id) ? bookmarks.filter((saved) => saved !== id) : [...bookmarks, id];
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setBookmarks(next);
  }

  const filteredStories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return stories.filter((story) => {
      const matchesSaved = view === "latest" || bookmarks.includes(story.id);
      const matchesSource = selectedSource === "Semua OPD" || story.sourceName === selectedSource;
      const searchable = `${story.title} ${story.excerpt} ${story.categories.join(" ")}`.toLocaleLowerCase(
        "id-ID",
      );
      return matchesSaved && matchesSource && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [stories, bookmarks, query, selectedSource, view]);

  const featured = view === "latest" && !query && selectedSource === "Semua OPD" ? filteredStories[0] : null;
  const listStories = featured ? filteredStories.slice(1) : filteredStories;

  return (
    <main className="page-shell">
      <div className="topline">
        <span className="topline-mark" aria-hidden="true" />
        <span>ACEH BARAT</span>
        <span className="topline-divider">/</span>
        <span>RINGKASAN BERITA DAERAH</span>
        <a href="/admin">ADMIN OPD</a>
        <a href="https://acehbaratkab.go.id/berita/feed" target="_blank" rel="noreferrer">
          SUMBER RESMI <span aria-hidden="true">↗</span>
        </a>
      </div>

      <header className="masthead">
        <Link className="brand" href="/" aria-label="Kabar Barat, beranda">
          <span className="brand-seal">KB</span>
          <span className="brand-name">kabar<span>barat</span></span>
        </Link>
        <div className="masthead-note">KABAR TERKINI DARI<br />BUMI TEUKU UMAR</div>
        <div className="live-indicator"><span /> FEED LANGSUNG</div>
      </header>

      <section className="intro-row">
        <div>
          <p className="eyebrow">KABUPATEN ACEH BARAT <span>·</span> {new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date())}</p>
          <h1>Berita <em>hari ini.</em></h1>
          <p className="intro-copy">Kabar terbaru dari pemerintah dan masyarakat Aceh Barat, dihimpun dari sumber resmi Pemkab dan perangkat daerah.</p>
        </div>
        <div className="edition-stamp"><span>EDISI DIGITAL</span><strong>01</strong><span>MEULABOH</span></div>
      </section>

      <div className="toolbar">
        <div className="view-tabs" role="tablist" aria-label="Tampilan berita">
          <button className={view === "latest" ? "tab active" : "tab"} onClick={() => setView("latest")} role="tab" aria-selected={view === "latest"}>
            Terbaru <span>{stories.length}</span>
          </button>
          <button className={view === "saved" ? "tab active" : "tab"} onClick={() => setView("saved")} role="tab" aria-selected={view === "saved"}>
            Tersimpan <span>{bookmarks.length}</span>
          </button>
        </div>
      </div>

      <section className="search-panel" aria-label="Pencarian berita">
        <div className="search-panel-heading">
          <div>
            <p className="search-eyebrow">TEMUKAN INFORMASI</p>
            <h2>Cari berita <em>Aceh Barat.</em></h2>
            <p className="search-description">Telusuri kabar berdasarkan kata kunci atau pilih perangkat daerah.</p>
          </div>
          <button className="refresh-button" onClick={() => void loadFeed()} disabled={loading} aria-label="Muat ulang berita" title="Muat ulang berita">
            <span className={loading ? "refresh-icon spinning" : "refresh-icon"} aria-hidden="true">↻</span>
          </button>
        </div>
        <label className="search-box search-box-large">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <span className="sr-only">Cari berita berdasarkan judul, ringkasan, atau topik</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contoh: pembangunan, kesehatan, pendidikan…" />
          {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Hapus pencarian">×</button>}
        </label>
        <div className="opd-filter">
          <div className="opd-filter-label">
            <span>JELAJAHI BERDASARKAN OPD</span>
            <span>{sourceNames.length} SUMBER</span>
          </div>
          <div className="opd-categories" role="group" aria-label="Filter berita berdasarkan OPD">
            <button className={selectedSource === "Semua OPD" ? "opd-chip active" : "opd-chip"} onClick={() => setSelectedSource("Semua OPD")} aria-pressed={selectedSource === "Semua OPD"}>
              Semua OPD <span>{stories.length}</span>
            </button>
            {sourceNames.map((name) => (
              <button className={selectedSource === name ? "opd-chip active" : "opd-chip"} key={name} onClick={() => setSelectedSource(name)} aria-pressed={selectedSource === name}>
                {name} <span>{stories.filter((story) => story.sourceName === name).length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="feed-meta">
        <span>{view === "saved" ? "KOLEKSI PRIBADI" : "PEMBARUAN TERBARU"}</span>
        <span>{updatedAt ? `DIPERBARUI ${formatTime(updatedAt)} WIB` : "MENGHUBUNGKAN KE SUMBER"}</span>
      </div>

      {error && (
        <div className="error-state" role="alert">
          <div><strong>Berita belum dapat dimuat.</strong><p>{error}</p></div>
          <button onClick={() => void loadFeed()}>Coba lagi <span aria-hidden="true">↗</span></button>
        </div>
      )}

      {!error && sourceFailures.length > 0 && (
        <div className="source-warning" role="status">
          Feed sementara tidak tersedia: {sourceFailures.join(", ")}.
        </div>
      )}

      {loading && stories.length === 0 && (
        <div className="loading-state" aria-live="polite"><span className="loading-line" /><span>Memuat berita Aceh Barat…</span></div>
      )}

      {!loading && !error && filteredStories.length === 0 && (
        <div className="empty-state">
          <span className="empty-mark">—</span>
          <h2>{view === "saved" && bookmarks.length === 0 ? "Belum ada berita tersimpan" : "Tidak ada berita ditemukan"}</h2>
          <p>{view === "saved" ? "Simpan artikel dengan tombol penanda untuk membacanya lagi nanti." : "Coba kata kunci atau pilih kategori OPD yang berbeda."}</p>
        </div>
      )}

      {featured && (
        <article className="featured-story">
          <div className="featured-copy">
            <div className="story-kicker"><span>{featured.sourceName.toLocaleUpperCase("id-ID")}</span><span className="kicker-rule" /></div>
            <time dateTime={featured.pubDate ?? undefined}>{formatDate(featured.pubDate)}</time>
            <h2><a href={featured.link} target="_blank" rel="noreferrer">{featured.title}</a></h2>
            {featured.excerpt && <p>{featured.excerpt}</p>}
            <a className="read-link" href={featured.link} target="_blank" rel="noreferrer">Baca selengkapnya <span aria-hidden="true">↗</span></a>
          </div>
          <div className="featured-art" aria-label="Ilustrasi berita utama">
            {featured.image ? <img src={featured.image} alt="" /> : <div className="art-pattern"><span>ACEH<br />BARAT</span><b>KB</b></div>}
            <div className="art-caption">MEULABOH <span>·</span> ACEH</div>
          </div>
          <button className={bookmarks.includes(featured.id) ? "bookmark-button saved" : "bookmark-button"} onClick={() => toggleBookmark(featured.id)} aria-label={bookmarks.includes(featured.id) ? "Hapus dari tersimpan" : "Simpan berita"} title={bookmarks.includes(featured.id) ? "Hapus dari tersimpan" : "Simpan berita"}>
            <BookmarkIcon filled={bookmarks.includes(featured.id)} />
          </button>
        </article>
      )}

      {listStories.length > 0 && (
        <section className="story-list" aria-label="Daftar berita">
          {listStories.map((story, index) => (
            <article className="story-row" key={story.id}>
              <div className="story-index">{String(index + (featured ? 2 : 1)).padStart(2, "0")}</div>
              <div className="story-body">
                <div className="story-meta">
                  <time dateTime={story.pubDate ?? undefined}>{formatDate(story.pubDate)}</time>
                  <span className="source-tag">{story.sourceName}</span>
                  {story.categories.slice(0, 1).map((name) => <span className="topic-tag" key={name}>{name}</span>)}
                </div>
                <h2><a href={story.link} target="_blank" rel="noreferrer">{story.title}</a></h2>
                {story.excerpt && <p>{story.excerpt}</p>}
              </div>
              <button className={bookmarks.includes(story.id) ? "bookmark-button saved" : "bookmark-button"} onClick={() => toggleBookmark(story.id)} aria-label={bookmarks.includes(story.id) ? "Hapus dari tersimpan" : "Simpan berita"} title={bookmarks.includes(story.id) ? "Hapus dari tersimpan" : "Simpan berita"}>
                <BookmarkIcon filled={bookmarks.includes(story.id)} />
              </button>
              <a className="row-arrow" href={story.link} target="_blank" rel="noreferrer" aria-label={`Baca ${story.title}`}>↗</a>
            </article>
          ))}
        </section>
      )}

      <footer className="page-footer">
        <span>DIHIMPUN DARI PEMKAB &amp; FEED OPD TERDAFTAR</span>
        <span>SELALU MERUJUK KE SUMBER ASLI <span aria-hidden="true">↗</span></span>
      </footer>
    </main>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="bookmark-icon">
      <path d="M5.25 3.5h9.5v13l-4.75-3-4.75 3v-13Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}