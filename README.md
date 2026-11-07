# Feather Android · Build 1.0

Klona Feather 3D untuk Android (target: PocoPad). Build 0.3 memigrasikan prototipe satu file HTML
ke **React + TypeScript + Vite** dengan inti 3D yang terpisah dari UI. Build 0.4 menambahkan
pemisahan input stylus dan jari, Build 0.5 tebal goresan per titik tekanan, dan Build 0.6 tampilan
yang meniru Feather asli.

## Menjalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
```

`npm run dev` memakai `host: true`, jadi dev server juga bisa dibuka dari tablet di Wi-Fi yang sama
(lihat alamat "Network" yang dicetak Vite, misalnya `http://192.168.x.x:5173`).

```bash
npm run typecheck  # cek tipe TypeScript
npm run build      # build produksi ke dist/
npm run preview    # coba hasil build
```

## Struktur

```
src/
  engine/            # TypeScript murni, TANPA React
    Engine.ts        # scene Three.js, input pointer, orkestrasi
    StrokeBuilder.ts # data goresan -> mesh tube
    StrokeLayer.ts   # menyimpan goresan, preview, picking untuk eraser
    Guides.ts        # panduan bola / kubus
    History.ts       # undo/redo berbasis command
    commands.ts      # AddStrokeCommand, RemoveStrokeCommand
    project.ts       # parsing berkas proyek (.fthr.json), kompatibel dengan 0.2
    types.ts
  ui/                # React, hanya untuk antarmuka
    Header.tsx  Toolbar.tsx  GuideBar.tsx  BrushPanel.tsx  CanvasStage.tsx  StatusBar.tsx
  store.ts           # state UI (Zustand): tool, kuas, mirror, guide, riwayat
  engineRef.ts       # akses ke instance Engine dari komponen
```

Aliran data: UI mengubah store → `CanvasStage` menyalin store ke engine (setter idempoten) →
engine memancarkan `onChange` (jumlah goresan, can undo/redo) kembali ke store.
Instance `Engine` tidak pernah masuk ke state React.

## Input stylus dan jari (Build 0.4)

Keputusan dibuat per pointer di `Engine.modeFor()`, dievaluasi sebelum OrbitControls menerima event:

- **Stylus (`pen`)**: mengikuti tool aktif (gambar / hapus / orbit).
- **Jari (`touch`)**: diatur oleh pengaturan *Finger touch* di panel Input.
  - *Auto* (default): jari menggambar sampai stylus pertama kali terdeteksi, setelah itu jari hanya
    navigasi (1 jari orbit, 2 jari pan + pinch zoom). Ini juga menjaga HP tanpa stylus tetap bisa menggambar.
  - *Always orbit* / *Always draw*: memaksa salah satunya.
- **Mouse**: tombol kiri mengikuti tool; tombol kanan = pan, tombol tengah/roda = zoom, pada tool apa pun.
- Saat goresan sedang dibuat, pointer lain (misalnya telapak tangan) tidak menggerakkan kamera dan tidak memulai goresan baru.

Catatan: pengenalan telapak tangan di level OS/browser tetap berlaku di atas ini, dan perilaku stylus
(tekanan, jenis pointer) bergantung pada perangkat. Perlu diuji langsung di PocoPad.

## Tampilan (Build 0.6)

Mengikuti video referensi Feather asli:

- Kanvas terang seperti kertas dengan grid halus. Goresan berupa tinta **datar tanpa kilau**
  (`MeshBasicMaterial`). Kuas bawaan: hitam dan tipis (ukuran 12).
- UI berupa panel melayang di atas kanvas layar penuh. Kiri: alat, warna, ukuran, dan opasitas
  (slider vertikal). Kanan atas: guide, mirror, dan tombol Settings. Kiri atas: undo/redo dan Open/Save/PNG.
- Pengaturan lanjutan (pressure response, visibilitas grid/guide, input jari, Input debug, Clear, Reset view)
  ada di lembar **Settings** yang bisa dibuka di layar sekecil apa pun. Sebelumnya panel kanan hilang di bawah 760px.
- Belum ada: bayangan jatuh dan permukaan terisi seperti di Feather asli.

## Tekanan dan bentuk goresan (Build 0.5)

- Tebal goresan kini mengikuti tekanan **per titik** (tabung radius variabel, `StrokeBuilder.ts`),
  dengan ujung awal dan akhir yang meruncing.
- Sampel stylus yang digabung Chrome diambil semua (`getCoalescedEvents`), jadi garis dan kurva tekanan lebih halus.
- Jika stylus tidak mengirim variasi tekanan (selisih < 0.04 dalam satu goresan), tebal garis **disimulasikan dari
  kecepatan**: pelan = tebal, cepat = tipis. Berlaku juga untuk mouse dan jari. Waktu tiap titik disimpan di berkas proyek.
- **Input debug** (panel Input): menampilkan jenis pointer, tekanan saat ini, dan rentang tekanan kontak terakhir
  untuk memastikan apakah perangkat benar-benar mengirim tekanan.
- Konstanta yang bisa disetel di `StrokeBuilder.ts`: `TAPER_MAX_LENGTH`, `TAPER_MIN_SCALE`, `PRESSURE_RANGE_EPS`,
  dan rumus `speedPressures`.

## Beda dengan Build 0.2

Perilaku gambar sama. Perubahan yang ikut terjadi karena arsitektur baru:

- Undo/redo/eraser kini memakai pola command, sehingga redo tidak lagi membuat group ganda dan eraser konsisten dengan undo.
- Warna, radius, opacity, tekanan, dan status mirror disimpan **per goresan**; redo tidak lagi bergantung pada tombol mirror saat itu.
- Kontrol orbit tidak lagi ikut bergerak saat goresan pertama (sebelumnya aktif sampai tool dipilih manual).
- Geometri preview goresan dibuang dengan benar (sebelumnya bocor memori).
- Dua jari/pointer kedua selama menggambar diabaikan.
- Tombol **Open** untuk memuat `.fthr.json` (juga file dari Build 0.2).
- Tanpa CDN: Three.js dibundel lokal, jadi bisa jalan offline.

## Select dan Transform (Build 1.0)

Tool Select menambah fitur tap untuk memilih goresan, lasso multi-select, serta transformasi Move/Rotate/Scale dengan preview langsung. Duplikasi, mirror, dan delete mengikuti operasi satu undo step, sementara transformasi mirroring di-bake jadi dua stroke independen.

## Yang belum dikerjakan

- Gizmo/joystick sumbu untuk transformasi, Group, ekspor GLTF/OBJ.
- Bayangan jatuh dan permukaan terisi (fill) seperti di Feather asli.
- Pipet warna, preset kuas, dan palet warna.
- Eraser belum menghapus saat digeser, hanya saat diketuk.
- Bungkus jadi APK dengan Capacitor.
