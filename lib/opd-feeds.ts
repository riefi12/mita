import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";

export type OpdFeed = {
  id: string;
  opdId: string;
  name: string;
  websiteUrl: string;
  feedUrl: string;
  enabled: boolean;
  createdAt: string;
};

type LegacyFeed = {
  id: string;
  name: string;
  websiteUrl?: string;
  feedUrl: string;
  enabled: boolean;
  createdAt: string;
};

type FeedRow = RowDataPacket & {
  feed_id: number;
  opd_id: number;
  nama_opd: string;
  link_website: string;
  link_feed: string;
  opd_aktif: number;
  feed_aktif: number;
};

const registryPath = join(process.cwd(), "data", "opd-feeds.json");
const requiredDatabaseSettings = [
  "MITA_DB_HOST",
  "MITA_DB_NAME",
  "MITA_DB_USER",
] as const;

declare global {
  var mitaMysqlPool: Pool | undefined;
  var mitaDatabaseReady: Promise<void> | undefined;
}

function mysqlConfiguration() {
  const configured = requiredDatabaseSettings.filter((key) => process.env[key]);
  if (configured.length === 0) return null;
  if (configured.length !== requiredDatabaseSettings.length) {
    throw new Error("Konfigurasi MySQL belum lengkap. Atur MITA_DB_HOST, MITA_DB_NAME, dan MITA_DB_USER.");
  }

  return {
    host: process.env.MITA_DB_HOST!,
    port: Number(process.env.MITA_DB_PORT || "3306"),
    database: process.env.MITA_DB_NAME!,
    user: process.env.MITA_DB_USER!,
    password: process.env.MITA_DB_PASSWORD || "",
    charset: "utf8mb4" as const,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

function pool(): Pool {
  const config = mysqlConfiguration();
  if (!config) throw new Error("Konfigurasi MySQL belum tersedia.");
  globalThis.mitaMysqlPool ??= createPool(config);
  return globalThis.mitaMysqlPool;
}

function isLegacyFeed(value: unknown): value is LegacyFeed {
  if (!value || typeof value !== "object") return false;
  const feed = value as Record<string, unknown>;
  return (
    typeof feed.id === "string" &&
    typeof feed.name === "string" &&
    (feed.websiteUrl === undefined || typeof feed.websiteUrl === "string") &&
    typeof feed.feedUrl === "string" &&
    typeof feed.enabled === "boolean" &&
    typeof feed.createdAt === "string"
  );
}

function websiteFromFeedUrl(feedUrl: string): string {
  const url = new URL(feedUrl);
  return `${url.protocol}//${url.host}`;
}

async function readLegacyFeeds(): Promise<OpdFeed[]> {
  try {
    const parsed = JSON.parse(await readFile(registryPath, "utf8")) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isLegacyFeed)) {
      throw new Error("Format registry OPD lama tidak valid.");
    }
    return parsed.map((feed) => ({
      ...feed,
      opdId: feed.id,
      websiteUrl: feed.websiteUrl ?? websiteFromFeedUrl(feed.feedUrl),
    }));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeLegacyFeeds(feeds: OpdFeed[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  const temporaryPath = `${registryPath}.${randomUUID()}.tmp`;
  const content = feeds.map((feed) => ({
    id: feed.id,
    name: feed.name,
    websiteUrl: feed.websiteUrl,
    feedUrl: feed.feedUrl,
    enabled: feed.enabled,
    createdAt: feed.createdAt,
  }));
  await writeFile(temporaryPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await rename(temporaryPath, registryPath);
}

async function ensureDatabase(): Promise<void> {
  globalThis.mitaDatabaseReady ??= (async () => {
    const databaseName = process.env.MITA_DB_NAME;
    if (!databaseName) throw new Error("MITA_DB_NAME belum dikonfigurasi.");
    const connection = await pool().getConnection();
    try {
      const [tableRows] = await connection.execute<RowDataPacket[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('user', 'opd', 'feed')`,
        [databaseName],
      );
      const existingTables = new Set(tableRows.map((row) => row.TABLE_NAME));
      const missingTables = ["user", "opd", "feed"].filter((table) => !existingTables.has(table));
      if (missingTables.length) {
        throw new Error(
          `Tabel MySQL belum tersedia (${missingTables.join(", ")}). Jalankan database/schema.sql terlebih dahulu.`,
        );
      }

      const legacyFeeds = await readLegacyFeeds();
      for (const feed of legacyFeeds) {
        await connection.execute(
          `INSERT INTO \`opd\` (\`nama_opd\`, \`link_website\`, \`is_aktif\`)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE \`id\` = LAST_INSERT_ID(\`id\`)`,
          [feed.name, feed.websiteUrl],
        );
        const [opdRows] = await connection.execute<RowDataPacket[]>(
          "SELECT `id` FROM `opd` WHERE `nama_opd` = ? AND `link_website` = ?",
          [feed.name, feed.websiteUrl],
        );
        const opdId = opdRows[0]?.id;
        if (!opdId) throw new Error(`OPD "${feed.name}" tidak dapat dimigrasikan.`);
        await connection.execute(
          `INSERT INTO \`feed\` (\`id_opd\`, \`link_feed\`, \`is_aktif\`) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE \`is_aktif\` = VALUES(\`is_aktif\`)`,
          [opdId, feed.feedUrl, feed.enabled ? 1 : 0],
        );
      }
    } catch (error) {
      globalThis.mitaDatabaseReady = undefined;
      throw error;
    } finally {
      connection.release();
    }
  })();

  await globalThis.mitaDatabaseReady;
}

function toOpdFeed(row: FeedRow): OpdFeed {
  return {
    id: String(row.feed_id),
    opdId: String(row.opd_id),
    name: row.nama_opd,
    websiteUrl: row.link_website,
    feedUrl: row.link_feed,
    enabled: Boolean(row.opd_aktif && row.feed_aktif),
    createdAt: "",
  };
}

export async function readOpdFeeds(): Promise<OpdFeed[]> {
  if (!mysqlConfiguration()) return readLegacyFeeds();
  await ensureDatabase();
  const [rows] = await pool().query<FeedRow[]>(
    `SELECT f.\`id\` AS feed_id, o.\`id\` AS opd_id, o.\`nama_opd\`, o.\`link_website\`,
            f.\`link_feed\`, o.\`is_aktif\` AS opd_aktif, f.\`is_aktif\` AS feed_aktif
     FROM \`feed\` f JOIN \`opd\` o ON o.\`id\` = f.\`id_opd\`
     ORDER BY o.\`nama_opd\`, f.\`id\``,
  );
  return rows.map(toOpdFeed);
}

export async function addOpdFeed(input: {
  name: string;
  websiteUrl: string;
  feedUrl: string;
}): Promise<OpdFeed> {
  if (!mysqlConfiguration()) {
    const feeds = await readLegacyFeeds();
    if (feeds.some((feed) => feed.feedUrl === input.feedUrl)) {
      throw new Error("DUPLICATE_FEED");
    }
    const existingOpd = feeds.find(
      (feed) => feed.name === input.name && feed.websiteUrl === input.websiteUrl,
    );
    const feed: OpdFeed = {
      id: randomUUID(),
      opdId: existingOpd?.opdId ?? randomUUID(),
      ...input,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    await writeLegacyFeeds([...feeds, feed]);
    return feed;
  }

  await ensureDatabase();
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      "SELECT `id`, `nama_opd`, `link_website` FROM `opd` WHERE `nama_opd` = ? OR `link_website` = ? FOR UPDATE",
      [input.name, input.websiteUrl],
    );
    const conflict = existingRows.find(
      (row) => row.nama_opd !== input.name || row.link_website !== input.websiteUrl,
    );
    if (conflict) throw new Error("OPD_NAME_OR_WEBSITE_CONFLICT");
    let opdId = existingRows[0]?.id as number | undefined;
    if (!opdId) {
      const [result] = await connection.execute(
        "INSERT INTO `opd` (`nama_opd`, `link_website`) VALUES (?, ?)",
        [input.name, input.websiteUrl],
      );
      opdId = (result as { insertId: number }).insertId;
    }

    const [existingFeeds] = await connection.execute<RowDataPacket[]>(
      "SELECT `id` FROM `feed` WHERE `id_opd` = ? AND `link_feed` = ?",
      [opdId, input.feedUrl],
    );
    if (existingFeeds.length) throw new Error("DUPLICATE_FEED");
    const [feedResult] = await connection.execute(
      "INSERT INTO `feed` (`id_opd`, `link_feed`) VALUES (?, ?)",
      [opdId, input.feedUrl],
    );
    await connection.commit();
    return {
      id: String((feedResult as { insertId: number }).insertId),
      opdId: String(opdId),
      ...input,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateOpdFeed(
  id: string,
  input: { name: string; websiteUrl: string; feedUrl: string },
): Promise<OpdFeed | null> {
  if (!mysqlConfiguration()) {
    const feeds = await readLegacyFeeds();
    const index = feeds.findIndex((feed) => feed.id === id);
    if (index === -1) return null;
    if (feeds.some((feed, feedIndex) => feedIndex !== index && feed.feedUrl === input.feedUrl)) {
      throw new Error("DUPLICATE_FEED");
    }
    feeds[index] = { ...feeds[index], ...input };
    await writeLegacyFeeds(feeds);
    return feeds[index];
  }

  await ensureDatabase();
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const [feedRows] = await connection.execute<RowDataPacket[]>(
      `SELECT f.\`id_opd\`, f.\`is_aktif\` AS feed_aktif, o.\`is_aktif\` AS opd_aktif
       FROM \`feed\` f JOIN \`opd\` o ON o.\`id\` = f.\`id_opd\`
       WHERE f.\`id\` = ? FOR UPDATE`,
      [id],
    );
    const opdId = feedRows[0]?.id_opd as number | undefined;
    if (!opdId) {
      await connection.rollback();
      return null;
    }

    const [conflicts] = await connection.execute<RowDataPacket[]>(
      "SELECT `id` FROM `opd` WHERE (`nama_opd` = ? OR `link_website` = ?) AND `id` <> ? FOR UPDATE",
      [input.name, input.websiteUrl, opdId],
    );
    if (conflicts.length) throw new Error("OPD_NAME_OR_WEBSITE_CONFLICT");

    const [duplicateFeeds] = await connection.execute<RowDataPacket[]>(
      "SELECT `id` FROM `feed` WHERE `id_opd` = ? AND `link_feed` = ? AND `id` <> ?",
      [opdId, input.feedUrl, id],
    );
    if (duplicateFeeds.length) throw new Error("DUPLICATE_FEED");

    await connection.execute(
      "UPDATE `opd` SET `nama_opd` = ?, `link_website` = ? WHERE `id` = ?",
      [input.name, input.websiteUrl, opdId],
    );
    await connection.execute("UPDATE `feed` SET `link_feed` = ? WHERE `id` = ?", [
      input.feedUrl,
      id,
    ]);
    const [updatedRows] = await connection.execute<FeedRow[]>(
      `SELECT f.\`id\` AS feed_id, f.\`id_opd\` AS opd_id, o.\`nama_opd\`, o.\`link_website\`,
              f.\`link_feed\`, o.\`is_aktif\` AS opd_aktif, f.\`is_aktif\` AS feed_aktif
       FROM \`feed\` f JOIN \`opd\` o ON o.\`id\` = f.\`id_opd\`
       WHERE f.\`id\` = ?`,
      [id],
    );
    await connection.commit();
    return updatedRows[0] ? toOpdFeed(updatedRows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setOpdFeedEnabled(id: string, enabled: boolean): Promise<OpdFeed | null> {
  if (!mysqlConfiguration()) {
    const feeds = await readLegacyFeeds();
    const index = feeds.findIndex((feed) => feed.id === id);
    if (index === -1) return null;
    feeds[index] = { ...feeds[index], enabled };
    await writeLegacyFeeds(feeds);
    return feeds[index];
  }
  await ensureDatabase();
  await pool().execute("UPDATE `feed` SET `is_aktif` = ? WHERE `id` = ?", [enabled ? 1 : 0, id]);
  const feeds = await readOpdFeeds();
  return feeds.find((feed) => feed.id === id) ?? null;
}

export async function deleteOpdFeed(id: string): Promise<boolean> {
  if (!mysqlConfiguration()) {
    const feeds = await readLegacyFeeds();
    const remainingFeeds = feeds.filter((feed) => feed.id !== id);
    if (remainingFeeds.length === feeds.length) return false;
    await writeLegacyFeeds(remainingFeeds);
    return true;
  }
  await ensureDatabase();
  const [result] = await pool().execute("DELETE FROM `feed` WHERE `id` = ?", [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}

export function validateFeedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const isAcehBaratDomain =
      host === "acehbaratkab.go.id" || host.endsWith(".acehbaratkab.go.id");
    if (
      url.protocol !== "https:" ||
      !isAcehBaratDomain ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function validateWebsiteUrl(value: unknown): string | null {
  const normalized = validateFeedUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  return `${url.protocol}//${url.host}`;
}
