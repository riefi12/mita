<div align="center">

# 📰 Kabar Barat

**Agregator Berita Resmi Pemerintah Kabupaten Aceh Barat**

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql)](https://www.mysql.com/)

Kabar Barat adalah agregator berita berbahasa Indonesia yang dirancang khusus untuk memusatkan informasi dari sumber-sumber resmi (OPD) Pemerintah Kabupaten Aceh Barat. Sistem ini membaca dari *sitemap* XML atau RSS langsung di level server, memberikan pengalaman membaca yang cepat dan terbebas dari kendala *Cross-Origin* (CORS) di sisi peramban.

</div>

---

## ✨ Fitur Utama

- 🔄 **Agregasi Otomatis:** Memuat dan menyegarkan berita dari feed Pemkab Aceh Barat serta *sitemap*/RSS OPD aktif yang terdaftar.
- 🔍 **Pencarian & Filter Cerdas:** Dilengkapi pencarian berdasarkan judul, ringkasan, dan topik (filter topik akan otomatis muncul jika didukung oleh feed).
- 🔖 **Bookmark Lokal:** Pengguna dapat menyimpan berita favorit langsung di peramban mereka.
- 🚀 **Kinerja & Keamanan:** 
  - Tautan artikel selalu mengarah ke sumber asli.
  - Gambar dan ringkasan dibersihkan (*sanitized*) di server sebelum ditampilkan.
  - Memiliki sistem *cache* selama 3 menit dan batas waktu permintaan (*timeout*) 12 detik untuk menjaga stabilitas.

---

## 🛠️ Persyaratan Sistem

Sebelum memulai, pastikan sistem Anda telah memiliki:
- **Node.js** (Versi 20 LTS atau lebih baru)
- **npm** (Node Package Manager)
- **MySQL** (Untuk konfigurasi database produksi)

---

## 🚀 Menjalankan Aplikasi

Ikuti langkah-langkah berikut untuk menjalankan aplikasi di lingkungan pengembangan lokal:

1. **Instalasi dependensi:**
   ```bash
   npm install
   ```

2. **Jalankan server *development*:**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

3. **Build untuk Produksi:**
   ```bash
   npm run build
   npm start
   ```

---

## 🗄️ Konfigurasi Database (MySQL)

Skema tabel dan database telah disediakan di `database/schema.sql`. 

### 1. Membuat Skema
Gunakan perintah berikut (contoh menggunakan PowerShell) untuk mengimpor skema ke MySQL:
```powershell
Get-Content .\database\schema.sql | mysql -u root -p
```
*Catatan Skema:* 
- Membuat database `mitadb` beserta tabel `user`, `opd`, dan `feed`. 
- Relasi tabel menggunakan *foreign key* `feed.id_opd` ke `opd.id` (menghapus OPD otomatis menghapus feed). 
- Dilengkapi kolom `is_aktif` untuk menonaktifkan sumber tanpa kehilangan data.
- Level akses `user`: `admin`, `operator`, atau `viewer` (login saat ini masih menggunakan password admin dari environment).

### 2. Mengatur Environment Variables
Salin file konfigurasi bawaan dan sesuaikan nilainya:
```bash
cp .env.example .env.local
```
Atur variabel kredensial database berikut di `.env.local`:
```env
MITA_DB_HOST=localhost
MITA_DB_PORT=3306
MITA_DB_NAME=mitadb
MITA_DB_USER=nama_user_database
MITA_DB_PASSWORD=rahasia
```
> **⚠️ Praktik Keamanan:** Gunakan akun MySQL khusus (*dedicated*) yang hanya memiliki hak akses pada `mitadb`, bukan menggunakan akun `root`.

*Mita dirancang untuk bersifat idempoten; saat konfigurasi MySQL aktif, tabel yang belum ada akan otomatis dibuat dan data lama dari `data/opd-feeds.json` akan diimpor. Jika MySQL tidak dikonfigurasi, Mita akan fallback menggunakan registry JSON untuk kebutuhan pengembangan lokal.*

---

## 🔐 Dashboard Admin OPD

Mita dilengkapi dengan dashboard pengelolaan sumber feed terpusat yang dapat diakses di `http://localhost:3000/admin`. 

### Pengaturan Keamanan Sesi
Tambahkan variabel environment ini di server Anda (atau di dalam `.env.local`):
```env
MITA_ADMIN_PASSWORD=kata_sandi_yang_kuat
MITA_ADMIN_SESSION_SECRET=secret_acak_minimal_32_karakter
```

**💡 Tips:** Anda dapat membuat *session secret* yang aman melalui PowerShell dengan perintah berikut:
```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### Aturan & Batasan Feed OPD
- Admin dapat menambah, mengedit, menonaktifkan, atau menghapus beberapa sumber RSS/sitemap untuk setiap OPD.
- **Kewajiban HTTPS:** Website dan sumber berita wajib menggunakan protokol HTTPS pada domain `acehbaratkab.go.id` atau subdomain resminya.
- **Batas Sitemap:** Mita akan memindai maksimal **8 berkas sitemap** per sumber dan mengambil maksimal **100 URL artikel** terbaru.
- **Penyimpanan:** Data registry OPD secara default tersimpan di `data/opd-feeds.json`. Untuk *deployment* produksi, pastikan menggunakan volume atau disk persisten yang dapat ditulis agar perubahan pada dashboard tidak hilang saat aplikasi di-*restart*.

---
<div align="center">
  <sub>Dibangun untuk Pemerintah Kabupaten Aceh Barat.</sub>
</div>
