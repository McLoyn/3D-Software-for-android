# Feather Android · Build 0.3

Klona Feather 3D untuk Android (target: PocoPad). Build 0.3 adalah migrasi dari prototipe satu file HTML
ke **React + TypeScript + Vite**, dengan inti 3D yang terpisah dari UI.

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
    Header.tsx  Toolbar.tsx  BrushPanel.tsx  CanvasStage.tsx  StatusBar.tsx
  store.ts           # state UI (Zustand): tool, kuas, mirror, guide, riwayat
  engineRef.ts       # akses ke instance Engine dari komponen
```

Aliran data: UI mengubah store → `CanvasStage` menyalin store ke engine (setter idempoten) →
engine memancarkan `onChange` (jumlah goresan, can undo/redo) kembali ke store.
Instance `Engine` tidak pernah masuk ke state React.

## Beda dengan Build 0.2

Perilaku gambar sama. Perubahan yang ikut terjadi karena arsitektur baru:

- Undo/redo/eraser kini memakai pola command, sehingga redo tidak lagi membuat group ganda dan eraser konsisten dengan undo.
- Warna, radius, opacity, tekanan, dan status mirror disimpan **per goresan**; redo tidak lagi bergantung pada tombol mirror saat itu.
- Kontrol orbit tidak lagi ikut bergerak saat goresan pertama (sebelumnya aktif sampai tool dipilih manual).
- Geometri preview goresan dibuang dengan benar (sebelumnya bocor memori).
- Dua jari/pointer kedua selama menggambar diabaikan.
- Tombol **Open** untuk memuat `.fthr.json` (juga file dari Build 0.2).
- Tanpa CDN: Three.js dibundel lokal, jadi bisa jalan offline.

## Yang belum dikerjakan

- Ketebalan masih memakai rata-rata tekanan per goresan (belum per titik).
- Jari = orbit, stylus = gambar (palm rejection).
- Panel pengaturan untuk layar kecil/ponsel (saat ini disembunyikan di bawah 760px).
- Eraser belum menghapus saat digeser, hanya saat diketuk.
- Bungkus jadi APK dengan Capacitor.
