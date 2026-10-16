# Absensi RFID USB — SMP AL-MIFTAH KETAPANG

Ekstrak paket, lalu buka **index.html** menggunakan Chrome/Edge terbaru untuk mencoba demo.
Buka **PANDUAN.html** untuk petunjuk lengkap pemasangan Firebase, GitHub Pages, dan WhatsApp.

## Pasang singkat

1. Buat Firebase **Spark**, Firestore **Standard (default)**, dan aktifkan Authentication Email/Password.
2. Buat akun petugas di Authentication. Tempel **UID** akun ke fungsi `admin()` di `firebase/firestore.rules`, lalu salin aturan ke Firestore Rules dan **Publish**.
3. Isi `apiKey` dan `projectId` asli di `app-config.js`.
4. Unggah isi paket ke akar repository GitHub. `index.html`, `app-config.js`, dan `assets/` harus langsung berada di akar; `assets/vendor/excel.js` ikut diunggah.
5. GitHub **Settings → Pages → Deploy from a branch → main → / (root)**.
6. Login aplikasi, buka Pengaturan, lalu Simpan pengaturan. Impor siswa melalui template aplikasi.

Tidak membutuhkan NPM, Node.js, Firebase CLI, Cloud Functions, atau Firebase Storage.
Data Firebase memerlukan internet. Reader harus USB HID keyboard dengan akhiran Enter; USB serial/COM tidak didukung langsung.

## Jadwal awal

- Masuk 07.00–08.00; tepat waktu sampai 07.15; terlambat mulai 07.16.
- Pulang 10.00–12.00; Senin–Sabtu; WIB. Seluruhnya dapat diubah di Pengaturan.
- Siswa tanpa catatan menjadi Alpa setelah batas masuk; izin/sakit dimasukkan lewat Koreksi di Rekap.
- Jam absensi mengikuti komputer petugas. Aktifkan sinkronisasi jam otomatis.

## WhatsApp

Tombol kirim manual membuka WhatsApp dan tetap memerlukan klik Kirim oleh petugas.
Otomatis memakai **Meta WhatsApp Cloud API** dan pengirim **Google Apps Script** di `whatsapp/Kode.gs`.
Isi Script Properties sesuai panduan. Jangan deploy sebagai Web App. Jalankan `cekKoneksi`, lalu `pasangPemicu`.
Firebase tetap Spark, tetapi **WhatsApp otomatis dapat berbiaya** dan memerlukan template Meta yang disetujui.
Nomor kosong atau tanpa persetujuan tidak dibuatkan antrean. Status “Diterima API” belum menjadi bukti diterima HP.

## Data dan keamanan

- Semua nama siswa dalam demo adalah fiktif. Demo disimpan lokal; Firebase hanya digunakan setelah dikonfigurasi dan login.
- ID RFID dan nomor WhatsApp adalah teks. Jangan hilangkan nol di depan saat menyiapkan Excel.
- Impor `.xlsx`/`.csv`, maksimal 5 MB dan 5.000 baris; rekap maksimal 31 hari tiap pengambilan.
- Jangan unggah data siswa/Excel/nomor orang tua/password/token ke repository publik.
- Aturan database membatasi UID admin dan akun pengirim. Semua koleksi lain tertutup.
- Data di perangkat lain muncul setelah **Perbarui**; tidak ada polling seluruh database secara otomatis.
- Arsip menyimpan satu tanggal nonaktif terakhir; mengaktifkan ulang belum menyimpan riwayat jeda arsip terpisah.

## Komponen

HTML/CSS/JavaScript tanpa framework. Firebase melalui REST resmi. Utilitas Excel OOXML/CSV asli pada `assets/vendor/excel.js`, tanpa CDN atau paket pihak ketiga. Membaca ZIP stored/deflate memakai `DecompressionStream` di browser modern. File `.xls` lama perlu disimpan ulang sebagai `.xlsx`.

Lihat **HASIL_PENGUJIAN.txt** untuk lingkup pengujian dan hal yang perlu diuji setelah konfigurasi sekolah.
