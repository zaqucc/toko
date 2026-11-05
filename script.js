const SUPABASE_URL = "https://rulhiqqvsbqsluxguzvs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BG8McDp-4A6WSy-P5M_cPA_y2Pg0PcG";
// Publishable key adalah API key non-JWT: kirim melalui header apikey saja.
const SUPABASE_HEADERS = {
    apikey: SUPABASE_PUBLISHABLE_KEY
};
const NOMOR_WHATSAPP_TOKO = "6285119818675"; // Semua tujuan WhatsApp toko menggunakan nomor ini // Nomor WhatsApp admin toko yang sudah digunakan checkout

/* ONGKIR GRATIS API KEY: OpenStreetMap + OSRM public demo.
 * Koordinat toko diisi dari tautan lokasi yang dikirim pemilik.
 * Catatan: server demo OSRM gratis untuk uji coba/pemakaian ringan, tanpa SLA produksi.
 */
const ONGKIR_CONFIG = {
    tokoLat: -6.5187284,
    tokoLng: 107.2301741,
    osrmEndpoint: 'https://router.project-osrm.org/route/v1/driving'
};

// Tarif ongkir Logi Express berdasarkan jarak rute berkendara.
// Batas menggunakan jarak aktual; jarak tambahan di atas 10 km dibulatkan ke atas per km.
function hitungTarifOngkir(jarakKm) {
    const jarak = Number(jarakKm);
    if (!Number.isFinite(jarak) || jarak < 0) throw new Error('Jarak pengiriman tidak valid.');
    if (jarak < 1) return 3000;
    if (jarak <= 3) return 5000;
    if (jarak <= 5) return 7000;
    if (jarak <= 7) return 9000;
    if (jarak <= 10) return 12000;
    return 12000 + Math.ceil(jarak - 10) * 1500;
}

let hasilOngkir = null;
let titikTujuanPengiriman = null;
let lokasiPelangganSaatIni = null;

let semuaProdukGlobal = [];

async function ambilDataProduk() {
    try {
        const data = await ambilDataProdukTersimpan();
        semuaProdukGlobal = data.products;
        inisialisasiKategori(semuaProdukGlobal, data.categories || []);
        tampilkanProduk(semuaProdukGlobal);
        if (data.offline) tampilkanStatusOffline(true);
    } catch (error) {
        console.error("Kesalahan API:", error);
        const grid = document.getElementById('konten-produk');
        if (grid) grid.innerHTML = `<div style="grid-column:span 2;text-align:center;padding:30px;"><p style="font-weight:700;">Katalog belum tersedia offline.</p><p style="font-size:12px;color:var(--text-gray);">Hubungkan internet sekali untuk menyimpan katalog di perangkat.</p></div>`;
    }
}

function inisialisasiKategori(daftarProduk, daftarKategori = []) {
    const container = document.getElementById('kategori-container');
    if (!container) return;

    const kategoriSet = new Set(
        daftarKategori.map(k => String(k.nama || '').trim()).filter(Boolean)
    );
    if (kategoriSet.size === 0) {
        daftarProduk.forEach(p => {
            if (p.kategori) kategoriSet.add(String(p.kategori).trim());
        });
    }

    let htmlButtons = `<button class="category-tab active" onclick="filterKategori('Semua', event)">Semua</button>`;
    kategoriSet.forEach(kat => {
        const aman = kat.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        htmlButtons += `<button class="category-tab" onclick="filterKategori('${aman}', event)">${kat}</button>`;
    });
    container.innerHTML = htmlButtons;
}
function filterKategori(namaKategori, e) {
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (e && e.currentTarget) {
        e.currentTarget.classList.add('active');
    }

    if (namaKategori === 'Semua') {
        tampilkanProduk(semuaProdukGlobal);
    } else {
        const hasilFilter = semuaProdukGlobal.filter(p => 
            p.kategori && String(p.kategori).trim().toLowerCase() === namaKategori.trim().toLowerCase()
        );
        tampilkanProduk(hasilFilter);
    }
}

function tampilkanProduk(daftarProduk) {
    const gridProduk = document.getElementById('konten-produk');
    if (!gridProduk) return;
    const jumlahProduk = document.getElementById('jumlah-produk');
    if (jumlahProduk) jumlahProduk.textContent = `${(daftarProduk || []).length} produk`;
    gridProduk.innerHTML = ""; 

    if (!daftarProduk || daftarProduk.length === 0) {
        gridProduk.innerHTML = `<p style="text-align: center; grid-column: span 2; color: var(--text-gray); padding: 20px;">Produk tidak ditemukan.</p>`;
        return;
    }

    daftarProduk.forEach(produk => {
        const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(produk.harga || 0);
        const fotoProduk = produk.foto_1_url || produk.foto || 'https://via.placeholder.com/150';
        const stokVal = Number(produk.stok) || 0;
        const isHabis = stokVal <= 0 || produk.aktif === false || produk.aktif === "FALSE" || produk.aktif === "False";
        
        const teksStok = isHabis ? "Habis" : `Stok: ${stokVal}`;
        const kelasStok = isHabis ? "stok-habis" : "stok-ready";
        const kelasBlur = isHabis ? "habis-blur" : "";
        const kelasTombol = isHabis ? "btn-round-add disabled-btn" : "btn-round-add";
        const ikonTombol = isHabis ? "block" : "add";

        gridProduk.innerHTML += `
            <div class="premium-card ${kelasBlur}">
                <div class="img-container" onclick="bukaDetailProduk('${produk.id}')" style="cursor: pointer;">
                    <span class="tag-stok ${kelasStok}">${teksStok}</span>
                    <img src="${fotoProduk}" class="premium-img" alt="${produk.nama || 'Produk'}">
                </div>
                <div class="info-container">
                    <h3 class="item-name" onclick="bukaDetailProduk('${produk.id}')" style="cursor: pointer;">${produk.nama || 'Tanpa Nama'}</h3>
                    <div class="price-action-row">
                        <p class="item-price">${hargaFormat}</p>
                        <button class="${kelasTombol}" ${isHabis ? 'disabled' : ''} onclick='tambahKeKeranjang(${JSON.stringify({...produk, foto: fotoProduk})})'>
                            <span class="material-icons-round" style="font-size: 20px;">${ikonTombol}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function bukaDetailProduk(idProduk) {
    window.location.href = `detail.html?id=${idProduk}`;
}

async function ambilDetailProduk() {
    const urlParams = new URLSearchParams(window.location.search);
    const idProduk = urlParams.get('id');

    if (!idProduk) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = await ambilDataProdukTersimpan();
        const produk = data.products.find(p => String(p.id) === String(idProduk));
        if (!produk) {
            alert("Produk tidak ditemukan.");
            window.location.href = 'index.html';
            return;
        }

        renderDetailHalaman(produk);
    } catch (error) {
        console.error("Error detail:", error);
        document.getElementById('detail-container').innerHTML = `<p style="text-align:center; padding:30px;">Detail produk belum tersimpan. Buka produk ini saat internet tersedia terlebih dahulu.</p>`;
    }
}

function renderDetailHalaman(p) {
    const container = document.getElementById('detail-container');
    if (!container) return;

    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const hargaFormat = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(Number(p.harga) || 0);
    const stokVal = Math.max(0, Number(p.stok) || 0);
    const isHabis = stokVal <= 0 || p.aktif === false ||
        String(p.aktif).toUpperCase() === 'FALSE';
    const fotoFallback = 'https://via.placeholder.com/800x800?text=Foto+Produk';
    const listFoto = [p.foto_1_url, p.foto_2_url, p.foto_3_url]
        .filter(url => typeof url === 'string' && url.trim())
        .slice(0, 3);
    if (!listFoto.length) listFoto.push(fotoFallback);

    const nama = escapeHTML(p.nama || 'Tanpa Nama');
    const kategori = escapeHTML(p.kategori || 'Umum');
    const deskripsi = escapeHTML(p.deskripsi || 'Informasi produk akan segera diperbarui.');
    const fotoUtama = escapeHTML(listFoto[0]);
    const statusText = isHabis ? 'Stok habis' : `Tersedia · ${stokVal} pcs`;

    const thumbnails = listFoto.length > 1 ? `
        <div class="detail-gallery-thumbs" aria-label="Pilih foto produk">
            ${listFoto.map((url, index) => `
                <button class="detail-thumb ${index === 0 ? 'is-active' : ''}" type="button"
                    data-photo-index="${index}" aria-label="Lihat foto ${index + 1}"
                    aria-pressed="${index === 0 ? 'true' : 'false'}">
                    <img src="${escapeHTML(url)}" alt="" loading="lazy">
                </button>
            `).join('')}
        </div>` : '';

    container.innerHTML = `
        <section class="detail-page-wrap">
            <div class="detail-gallery">
                <div class="detail-main-photo">
                    <img src="${fotoUtama}" id="foto-utama" class="main-img-medium"
                        alt="${nama}" fetchpriority="high">
                    <span class="detail-photo-count">${listFoto.length} foto</span>
                </div>
                ${thumbnails}
            </div>

            <section class="detail-content-card">
                <div class="detail-badge-row">
                    <span class="detail-kategori-pill">${kategori}</span>
                    <span class="detail-stock ${isHabis ? 'is-empty' : 'is-ready'}">
                        <span class="detail-stock-dot"></span>${statusText}
                    </span>
                </div>

                <h1 class="detail-nama">${nama}</h1>
                <p class="detail-price-label">Harga produk</p>
                <div class="detail-harga-tag">${hargaFormat}</div>

                <div class="detail-info-divider"></div>
                <div class="detail-deskripsi-box">
                    <h2>Deskripsi produk</h2>
                    <p>${deskripsi}</p>
                </div>
            </section>

            <p class="detail-assurance">
                <span class="material-icons-round">verified_user</span>
                Belanja praktis dan mudah di Loji Express
            </p>
        </section>
    `;

    const mainPhoto = document.getElementById('foto-utama');
    container.querySelectorAll('[data-photo-index]').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.photoIndex);
            if (!listFoto[index] || !mainPhoto) return;
            mainPhoto.src = listFoto[index];
            container.querySelectorAll('.detail-thumb').forEach(thumb => {
                const active = thumb === button;
                thumb.classList.toggle('is-active', active);
                thumb.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        });
    });

    const actionBeli = document.getElementById('action-beli-container');
    if (!actionBeli) return;
    if (isHabis) {
        actionBeli.innerHTML = `
            <div class="detail-action-inner">
                <button class="btn-add-to-cart-modern" type="button" disabled>STOK HABIS</button>
            </div>`;
    } else {
        const productForCart = {
            id: p.id, nama: p.nama || 'Tanpa Nama', harga: Number(p.harga) || 0,
            stok: stokVal, foto: listFoto[0]
        };
        actionBeli.innerHTML = `
            <div class="detail-action-inner">
                <button class="btn-add-to-cart-modern" id="detail-add-cart" type="button">
                    <span>Tambah ke Keranjang</span>
                </button>
            </div>`;
        document.getElementById('detail-add-cart')?.addEventListener('click', () => {
            tambahKeKeranjang(productForCart);
        });
    }
}

function gantiFotoUtama(url, el) {
    document.getElementById('foto-utama').src = url;
    document.querySelectorAll('.thumb-clean').forEach(img => img.classList.remove('active-thumb'));
    el.classList.add('active-thumb');
}

function bacaKeranjangAman() {
    try {
        const data = JSON.parse(localStorage.getItem('keranjang') || '[]');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Data keranjang tidak valid:', error);
        return [];
    }
}

function perbaruiBadgeKeranjang() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;
    const jumlah = bacaKeranjangAman().reduce((total, item) => total + Math.max(0, Number(item.jumlah) || 0), 0);
    badge.textContent = jumlah > 99 ? '99+' : String(jumlah);
    badge.hidden = jumlah === 0;
    badge.setAttribute('aria-label', jumlah ? `${jumlah} barang di keranjang` : 'Keranjang kosong');
}

function scrollKeKategori() {
    const kategori = document.getElementById('kategori-container');
    if (!kategori) return;
    kategori.scrollIntoView({ behavior: 'smooth', block: 'center' });
    kategori.querySelector('.category-tab')?.focus({ preventScroll: true });
}

function toggleSearchModal() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('search-input');
    const dockNav = document.querySelector('.dock-nav');

    if (modal) {
        const isOpen = modal.style.display === 'block';
        modal.style.display = isOpen ? 'none' : 'block';
        if (dockNav) {
            dockNav.style.transform = isOpen ? 'translateX(-50%)' : 'translate(-50%, 150px)';
            dockNav.style.opacity = isOpen ? '1' : '0';
        }
        if (!isOpen) {
            input.focus();
        } else {
            input.value = '';
            tampilkanProduk(semuaProdukGlobal);
        }
    }
}

function handleSearch(keyword) {
    const query = keyword.toLowerCase().trim();
    const hasilFilter = semuaProdukGlobal.filter(produk => 
        produk.nama && String(produk.nama).toLowerCase().includes(query)
    );
    tampilkanProduk(hasilFilter);
}

function tambahKeKeranjang(produk) {
    const stokVal = Number(produk.stok) || 0;
    if (stokVal <= 0) {
        alert(`⚠️ Maaf, stok untuk "${produk.nama}" sudah habis.`);
        return;
    }

    let keranjang = JSON.parse(localStorage.getItem('keranjang')) || [];
    const indexExist = keranjang.findIndex(item => item.id === produk.id);
    const fotoItem = produk.foto || produk.foto_1_url || '';
    
    if (indexExist !== -1) {
        if (keranjang[indexExist].jumlah >= stokVal) {
            alert(`⚠️ Jumlah pembelian tidak boleh melebihi batas stok tersedia (${stokVal} pcs).`);
            return;
        }
        keranjang[indexExist].jumlah += 1;
    } else {
        keranjang.push({
            id: produk.id,
            nama: produk.nama,
            harga: produk.harga,
            foto: fotoItem,
            jumlah: 1
        });
    }
    
    localStorage.setItem('keranjang', JSON.stringify(keranjang));
    perbaruiBadgeKeranjang();
    tampilkanNotifikasiKeranjang(produk, indexExist !== -1);
}

// Toast notifikasi ringkas untuk konfirmasi tambah ke keranjang.
let timerNotifikasiKeranjang;
function tampilkanNotifikasiKeranjang(produk, sudahAda) {
    let toast = document.getElementById('logi-cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'logi-cart-toast';
        toast.className = 'logi-cart-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }

    const foto = produk.foto || produk.foto_1_url || '';
    const jumlah = (JSON.parse(localStorage.getItem('keranjang')) || [])
        .reduce((total, item) => total + (Number(item.jumlah) || 0), 0);
    const aman = (nilai) => String(nilai ?? '').replace(/[&<>"']/g, karakter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[karakter]);

    toast.innerHTML = `
        <div class="logi-toast-icon"><span class="material-icons-round">check</span></div>
        ${foto ? `<img class="logi-toast-product" src="${aman(foto)}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="logi-toast-copy">
            <strong>${sudahAda ? 'Jumlah diperbarui' : 'Berhasil ditambahkan!'}</strong>
            <span>${aman(produk.nama)}</span>
            <small>${jumlah} item di keranjang</small>
        </div>
        <a class="logi-toast-action" href="order.html" aria-label="Lihat keranjang">Lihat <span class="material-icons-round">arrow_forward</span></a>
        <button class="logi-toast-close" type="button" aria-label="Tutup notifikasi"><span class="material-icons-round">close</span></button>
        <span class="logi-toast-progress"></span>`;

    toast.querySelector('.logi-toast-close').addEventListener('click', () => {
        clearTimeout(timerNotifikasiKeranjang);
        toast.classList.remove('is-visible');
    });
    clearTimeout(timerNotifikasiKeranjang);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    timerNotifikasiKeranjang = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function renderKeranjang() {
    let keranjang = JSON.parse(localStorage.getItem('keranjang')) || [];
    const wadah = document.getElementById('daftar-keranjang');
    if (!wadah) return;

    wadah.innerHTML = "";
    if (keranjang.length === 0) {
        wadah.innerHTML = '<p style="text-align:center; color:var(--text-gray); padding:20px;">Keranjang belanja Anda masih kosong.</p>';
        hitungUlangTotal();
        return;
    }

    keranjang.forEach((item, index) => {
        let subtotal = item.harga * item.jumlah;
        const formatSubtotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subtotal);
        wadah.innerHTML += `
            <div class="cart-item">
                <img src="${item.foto}" class="item-img-cart">
                <div style="flex: 1;">
                    <h3 style="font-size: 13.5px; font-weight: 600; margin: 0 0 4px 0;">${item.nama}</h3>
                    <p style="font-size: 14px; font-weight: 700; color: var(--accent-orange); margin: 0;">${formatSubtotal} (${item.jumlah}x)</p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button onclick="ubahJumlah(${index}, -1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e0e4ec; background: #ffffff; font-weight: bold; cursor: pointer;">-</button>
                    <span style="font-size: 13px; font-weight: 600;">${item.jumlah}</span>
                    <button onclick="ubahJumlah(${index}, 1)" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e0e4ec; background: #ffffff; font-weight: bold; cursor: pointer;">+</button>
                </div>
            </div>
        `;
    });
    hitungUlangTotal();
}

function ubahJumlah(index, perubahan) {
    let keranjang = JSON.parse(localStorage.getItem('keranjang')) || [];
    keranjang[index].jumlah += perubahan;
    if (keranjang[index].jumlah <= 0) keranjang.splice(index, 1);
    localStorage.setItem('keranjang', JSON.stringify(keranjang));
    renderKeranjang();
}

function hitungUlangTotal() {
    const keranjang = JSON.parse(localStorage.getItem('keranjang')) || [];
    const subtotal = keranjang.reduce((sum, item) => sum + ((Number(item.harga) || 0) * (Number(item.jumlah) || 0)), 0);
    const ongkir = hasilOngkir ? hasilOngkir.biaya : null;
    const elSubtotal = document.getElementById('subtotal-produk');
    const elOngkir = document.getElementById('ongkir-akhir');
    const elTotal = document.getElementById('total-akhir');
    if (elSubtotal) elSubtotal.textContent = rupiah(subtotal);
    if (elOngkir) elOngkir.textContent = ongkir === null ? 'Belum dihitung' : rupiah(ongkir);
    if (elTotal) elTotal.textContent = ongkir === null ? '—' : rupiah(subtotal + ongkir);
}

function aturStatusOngkir(pesan, status = '') {
    const el = document.getElementById('ongkir-status');
    if (el) {
        el.textContent = pesan;
        el.className = `shipping-status${status ? ` ${status}` : ''}`;
    }
}

function alamatPengirimanBerubah() {
    // Alamat teks hanya membantu kurir; titik dan ongkir berasal dari GPS saat dihitung.
    hitungUlangTotal();
}

function ambilLokasiDanHitungOngkir() {
    if (!navigator.geolocation) {
        aturStatusOngkir('Browser ini tidak mendukung lokasi. Buka website melalui HTTPS di Chrome atau browser modern.', 'is-error');
        return;
    }
    const tombol = document.getElementById('pilih-lokasi-btn');
    if (tombol) { tombol.disabled = true; tombol.innerHTML = '<span class="material-icons-round">sync</span> Mengambil lokasi…'; }
    aturStatusOngkir('Meminta izin GPS. Setelah lokasi didapat, ongkir akan dihitung otomatis.');
    navigator.geolocation.getCurrentPosition(async posisi => {
        lokasiPelangganSaatIni = {
            lat: posisi.coords.latitude,
            lng: posisi.coords.longitude
        };
        titikTujuanPengiriman = { ...lokasiPelangganSaatIni };
        await hitungOngkirBerdasarkanJarak(true);
        if (tombol) {
            tombol.disabled = false;
            tombol.innerHTML = '<span class="material-icons-round">my_location</span> Perbarui lokasi & ongkir';
        }
    }, error => {
        let pesan = 'Lokasi tidak berhasil diakses.';
        if (error.code === 1) pesan = 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi.';
        else if (error.code === 2) pesan = 'Lokasi perangkat tidak tersedia. Aktifkan GPS/Lokasi pada HP lalu coba lagi.';
        else if (error.code === 3) pesan = 'GPS terlalu lama merespons. Coba lagi di area dengan sinyal GPS lebih baik.';
        aturStatusOngkir(pesan, 'is-error');
        if (tombol) { tombol.disabled = false; tombol.innerHTML = '<span class="material-icons-round">my_location</span> Coba lagi: lokasi & ongkir'; }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

function tampilkanStatusCheckout(pesan, status = '') {
    const el = document.getElementById('checkout-status');
    if (!el) return;
    el.textContent = pesan;
    el.className = `checkout-status${status ? ` ${status}` : ''}`;
    el.hidden = !pesan;
}

async function prosesCheckoutDenganGPS() {
    const keranjang = bacaKeranjangAman();
    const nama = document.getElementById('nama')?.value.trim() || '';
    const alamat = document.getElementById('alamat')?.value.trim() || '';
    const tombol = document.getElementById('checkout-submit');

    if (!keranjang.length) {
        tampilkanPopupPesanError('Keranjang masih kosong', 'Tambahkan produk terlebih dahulu sebelum membuat pesanan.');
        return;
    }
    if (!nama || !alamat) {
        tampilkanStatusCheckout('Lengkapi nama penerima dan alamat lengkap terlebih dahulu.', 'is-error');
        if (!nama) document.getElementById('nama')?.focus();
        else document.getElementById('alamat')?.focus();
        return;
    }
    if (!navigator.geolocation) {
        tampilkanStatusCheckout('Perangkat atau browser ini tidak mendukung akses GPS. Gunakan browser yang mendukung lokasi.', 'is-error');
        return;
    }

    if (tombol) {
        tombol.disabled = true;
        tombol.textContent = 'Mengambil lokasi…';
    }
    tampilkanStatusCheckout('Meminta izin lokasi perangkat. Pastikan GPS aktif dan izinkan akses lokasi.');

    try {
        const posisi = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            });
        });

        lokasiPelangganSaatIni = {
            lat: posisi.coords.latitude,
            lng: posisi.coords.longitude
        };
        titikTujuanPengiriman = { ...lokasiPelangganSaatIni };
        tampilkanStatusCheckout('Lokasi ditemukan. Sedang menghitung jarak dan ongkir…');
        await hitungOngkirBerdasarkanJarak();

        if (!hasilOngkir) {
            tampilkanStatusCheckout('Ongkir belum berhasil dihitung. Periksa koneksi internet atau coba lagi di tempat dengan sinyal GPS lebih baik.', 'is-error');
            return;
        }

        tampilkanStatusCheckout('Ongkir berhasil dihitung. Menyiapkan ringkasan pesanan…', 'is-success');
        kirimKeWhatsApp();
    } catch (error) {
        let pesan = 'Lokasi tidak berhasil diakses. Aktifkan GPS lalu coba lagi.';
        if (error && error.code === 1) pesan = 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini melalui pengaturan browser.';
        else if (error && error.code === 2) pesan = 'Lokasi perangkat tidak tersedia. Aktifkan GPS/Lokasi pada HP lalu coba lagi.';
        else if (error && error.code === 3) pesan = 'GPS terlalu lama merespons. Coba lagi di area terbuka dengan sinyal GPS lebih baik.';
        tampilkanStatusCheckout(pesan, 'is-error');
    } finally {
        if (tombol) {
            tombol.disabled = false;
            tombol.textContent = 'Lanjutkan Pesanan';
        }
    }
}

async function hitungOngkirBerdasarkanJarak(dariTombol = false) {
    const tombol = document.getElementById('pilih-lokasi-btn');
    if (!titikTujuanPengiriman) {
        aturStatusOngkir('Tekan tombol lokasi terlebih dahulu dan izinkan akses GPS.', 'is-warning');
        return;
    }
    if (tombol) {
        tombol.disabled = true;
        tombol.innerHTML = '<span class="material-icons-round">sync</span> Menghitung ongkir…';
    }
    aturStatusOngkir('Menghitung rute berkendara dari toko ke posisi GPS kamu…');
    try {
        const asal = `${ONGKIR_CONFIG.tokoLng},${ONGKIR_CONFIG.tokoLat}`;
        const tujuan = `${titikTujuanPengiriman.lng},${titikTujuanPengiriman.lat}`;
        const url = `${ONGKIR_CONFIG.osrmEndpoint}/${asal};${tujuan}?overview=false&steps=false`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`Layanan rute mengembalikan HTTP ${response.status}. Coba lagi beberapa saat.`);
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Rute berkendara ke posisi GPS ini tidak ditemukan. Coba perbarui lokasi di tempat terbuka.');
        const route = data.routes[0];
        const jarakKm = route.distance / 1000;
        const jarakDibulatkan = Math.ceil(jarakKm);
        const ongkir = hitungTarifOngkir(jarakKm);
        const jarakTeks = `${jarakKm.toFixed(1)} km`;
        const alamat = document.getElementById('alamat')?.value.trim() || '';
        hasilOngkir = {
            alamat, jarakKm, jarakTeks, jarakDibulatkan, biaya: ongkir,
            tujuanLat: titikTujuanPengiriman.lat, tujuanLng: titikTujuanPengiriman.lng
        };
        const jarakEl = document.getElementById('jarak-pengiriman');
        if (jarakEl) jarakEl.textContent = `${jarakTeks} (tarif dihitung untuk ${jarakDibulatkan} km)`;
        aturStatusOngkir(`Ongkir berhasil dihitung otomatis berdasarkan tarif bertingkat Logi Express. Untuk jarak di atas 10 km, biaya bertambah Rp1.500 per km.`, 'is-success');
        hitungUlangTotal();
    } catch (error) {
        hasilOngkir = null;
        if (document.getElementById('jarak-pengiriman')) document.getElementById('jarak-pengiriman').textContent = 'Tidak tersedia';
        aturStatusOngkir(error.message || 'Gagal menghitung rute. Periksa koneksi internet lalu coba lagi.', 'is-error');
        hitungUlangTotal();
    } finally {
        if (tombol) {
            tombol.disabled = false;
            tombol.innerHTML = '<span class="material-icons-round">my_location</span> Gunakan lokasi saya';
        }
    }
}

let dataPesananWhatsApp = null;

function rupiah(nilai) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(nilai || 0);
}

function kirimKeWhatsApp() {
    const keranjang = JSON.parse(localStorage.getItem('keranjang')) || [];
    const nama = document.getElementById('nama')?.value.trim() || '';
    const alamat = document.getElementById('alamat')?.value.trim() || '';
    if (keranjang.length === 0) {
        tampilkanPopupPesanError('Keranjang masih kosong', 'Tambahkan produk terlebih dahulu sebelum membuat pesanan.');
        return;
    }
    if (!nama || !alamat) {
        tampilkanPopupPesanError('Data belum lengkap', 'Lengkapi nama penerima dan alamat lengkap agar pesanan bisa diproses.');
        if (!nama) document.getElementById('nama')?.focus();
        else document.getElementById('alamat')?.focus();
        return;
    }
    if (!hasilOngkir) {
        tampilkanPopupPesanError('Ongkir belum dihitung', 'Tekan tombol Lanjutkan Pesanan dan izinkan akses GPS agar ongkir dihitung otomatis terlebih dahulu.');
        return;
    }

    const subtotal = keranjang.reduce((sum, item) => sum + ((Number(item.harga) || 0) * (Number(item.jumlah) || 0)), 0);
    const ongkir = hasilOngkir.biaya;
    const total = subtotal + ongkir;
    const jumlahItem = keranjang.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
    dataPesananWhatsApp = { keranjang, nama, alamat, subtotal, ongkir, total, jarakKm: hasilOngkir.jarakKm, jarakTeks: hasilOngkir.jarakTeks, jarakDibulatkan: hasilOngkir.jarakDibulatkan, tujuanLat: hasilOngkir.tujuanLat, tujuanLng: hasilOngkir.tujuanLng };

    document.getElementById('wa-modal-icon').textContent = 'chat';
    document.getElementById('wa-modal-eyebrow').textContent = 'KONFIRMASI PESANAN';
    document.getElementById('wa-modal-title').textContent = 'Lanjut pesan via WhatsApp?';
    document.getElementById('wa-modal-desc').textContent = 'Periksa subtotal produk, jarak pengiriman, ongkir, dan total pembayaran sebelum melanjutkan.';
    document.getElementById('wa-order-summary').style.display = 'block';
    document.getElementById('wa-summary-name').textContent = nama;
    document.getElementById('wa-summary-count').textContent = `${jumlahItem} item`;
    document.getElementById('wa-summary-subtotal').textContent = rupiah(subtotal);
    document.getElementById('wa-summary-distance').textContent = hasilOngkir.jarakTeks;
    document.getElementById('wa-summary-shipping').textContent = rupiah(ongkir);
    document.getElementById('wa-summary-total').textContent = rupiah(total);
    document.getElementById('wa-modal-actions').innerHTML = `
        <button class="wa-btn-secondary" type="button" onclick="tutupPopupPesan()">Periksa lagi</button>
        <button class="wa-btn-primary" type="button" onclick="lanjutKeWhatsApp()"><span class="material-icons-round">send</span> Lanjut ke WhatsApp</button>`;
    bukaPopupPesan();
}

function tampilkanPopupPesanError(judul, pesan) {
    dataPesananWhatsApp = null;
    document.getElementById('wa-modal-icon').textContent = 'info';
    document.getElementById('wa-modal-eyebrow').textContent = 'PERLU DIPERIKSA';
    document.getElementById('wa-modal-title').textContent = judul;
    document.getElementById('wa-modal-desc').textContent = pesan;
    document.getElementById('wa-order-summary').style.display = 'none';
    document.getElementById('wa-modal-actions').innerHTML = `
        <button class="wa-btn-primary wa-btn-full" type="button" onclick="tutupPopupPesan()">Mengerti</button>`;
    bukaPopupPesan();
}

function bukaPopupPesan() {
    const overlay = document.getElementById('wa-confirm-overlay');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wa-modal-open');
}

function tutupPopupPesan() {
    const overlay = document.getElementById('wa-confirm-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('wa-modal-open');
}

function klikLuarPopupPesan(event) {
    if (event.target === event.currentTarget) tutupPopupPesan();
}

function lanjutKeWhatsApp() {
    if (!dataPesananWhatsApp) return;
    const { keranjang, nama, alamat, ongkir, total } = dataPesananWhatsApp;
    const rincianItem = keranjang.map((item, index) =>
        `${index + 1}. ${item.nama} (${item.jumlah}x) - ${rupiah((Number(item.harga) || 0) * (Number(item.jumlah) || 0))}`
    ).join('\n');
    const teksPesan = `Halo Admin Loji Express, saya ingin memesan:\n\n` +
        `DATA PENERIMA\nNama: ${nama}\nAlamat: ${alamat}\n\n` +
        `RINCIAN PESANAN\n${rincianItem}\n\n` +
        `ONGKIR: ${rupiah(ongkir)}\n\n` +
        `TOTAL PEMBAYARAN: ${rupiah(total)}\n\n` +
        `Mohon segera diproses ya kak. Terima kasih!`;
    const urlWhatsApp = `https://wa.me/${NOMOR_WHATSAPP_TOKO}?text=${encodeURIComponent(teksPesan)}`;
    const tabWhatsApp = window.open(urlWhatsApp, '_blank');

    if (tabWhatsApp) {
        localStorage.removeItem('keranjang');
        perbaruiBadgeKeranjang();
        dataPesananWhatsApp = null;
        hasilOngkir = null;
        tutupPopupPesan();
        renderKeranjang();
    } else {
        document.getElementById('wa-modal-title').textContent = 'WhatsApp belum terbuka';
        document.getElementById('wa-modal-desc').textContent = 'Browser mungkin memblokir jendela baru. Izinkan pop-up untuk situs ini lalu tekan tombol WhatsApp sekali lagi.';
        document.getElementById('wa-modal-icon').textContent = 'open_in_new';
        document.getElementById('wa-modal-eyebrow').textContent = 'PESANAN BELUM DIKIRIM';
        document.getElementById('wa-modal-actions').innerHTML = `
            <button class="wa-btn-secondary" type="button" onclick="tutupPopupPesan()">Tutup</button>
            <a class="wa-btn-primary" href="${urlWhatsApp}" target="_blank" rel="noopener noreferrer"><span class="material-icons-round">chat</span> Buka WhatsApp</a>`;
    }
}

/* Loji Express — Pusat Bantuan */
function bukaPusatBantuan() {
    const overlay = document.getElementById('help-center-overlay');
    if (!overlay) return;
    kembaliKePilihanBantuan();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('help-modal-open');
    const closeButton = overlay.querySelector('.help-close');
    if (closeButton) closeButton.focus();
}

function tutupPusatBantuan() {
    const overlay = document.getElementById('help-center-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('help-modal-open');
}

function klikLuarPusatBantuan(event) {
    if (event.target === event.currentTarget) tutupPusatBantuan();
}

function kembaliKePilihanBantuan() {
    const options = document.getElementById('help-center-options');
    const guide = document.getElementById('help-center-guide');
    const intro = document.getElementById('help-center-intro');
    if (options) options.hidden = false;
    if (guide) guide.hidden = true;
    if (intro) intro.textContent = 'Ada yang bisa kami bantu? Pilih bantuan yang kamu butuhkan.';
}

function tampilkanPanduanBelanja() {
    const options = document.getElementById('help-center-options');
    const guide = document.getElementById('help-center-guide');
    const intro = document.getElementById('help-center-intro');
    if (options) options.hidden = true;
    if (guide) guide.hidden = false;
    if (intro) intro.textContent = 'Ikuti langkah sederhana ini untuk menyelesaikan belanja.';
}

function bantuanWhatsApp(jenis) {
    const pesan = jenis === 'pesanan'
        ? 'Halo Admin Loji Express, saya ingin meminta bantuan terkait pesanan.\n\nNama: \nTanggal/waktu pesanan: \nKendala: '
        : 'Halo Admin Loji Express, saya ingin bertanya tentang produk dan layanan toko.\n\nPertanyaan saya: ';
    const url = `https://wa.me/${NOMOR_WHATSAPP_TOKO}?text=${encodeURIComponent(pesan)}`;
    const tab = window.open(url, '_blank');
    if (!tab) window.location.href = url;
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        tutupPusatBantuan();
    }
});


/* PWA Loji Express — katalog Supabase dan cache offline perangkat. */
const KUNCI_KATALOG_CACHE = 'logiexpress_katalog_cache_v2';

async function ambilDataProdukTersimpan() {
    try {
        const opsiFetch = { method: 'GET', headers: SUPABASE_HEADERS, cache: 'no-store' };
        const [resProduk, resKategori] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/products?select=id,nama,kategori,harga,stok,deskripsi,foto_1_url,foto_2_url,foto_3_url,aktif,urutan&aktif=eq.true&order=urutan.asc,nama.asc`, opsiFetch),
            fetch(`${SUPABASE_URL}/rest/v1/categories?select=nama,urutan&aktif=eq.true&order=urutan.asc,nama.asc`, opsiFetch)
        ]);

        if (!resProduk.ok) throw new Error(`Gagal mengambil produk dari Supabase (HTTP ${resProduk.status}).`);
        if (!resKategori.ok) throw new Error(`Gagal mengambil kategori dari Supabase (HTTP ${resKategori.status}).`);

        const [products, categories] = await Promise.all([resProduk.json(), resKategori.json()]);
        if (!Array.isArray(products) || !Array.isArray(categories)) throw new Error('Format katalog Supabase tidak sesuai.');

        const hasil = { products, categories, savedAt: Date.now() };
        try { localStorage.setItem(KUNCI_KATALOG_CACHE, JSON.stringify(hasil)); } catch (e) {}
        tampilkanStatusOffline(false);
        return { ...hasil, offline: false };
    } catch (error) {
        console.error('Supabase katalog:', error);
        try {
            const tersimpan = localStorage.getItem(KUNCI_KATALOG_CACHE);
            if (tersimpan) {
                const cache = JSON.parse(tersimpan);
                if (cache && Array.isArray(cache.products)) {
                    return {
                        products: cache.products,
                        categories: Array.isArray(cache.categories) ? cache.categories : [],
                        offline: true,
                        savedAt: cache.savedAt
                    };
                }
            }
        } catch (cacheError) {
            console.warn('Cache katalog tidak dapat dibaca:', cacheError);
        }
        throw error;
    }
}
function tampilkanStatusOffline(offline) {
    let bar = document.getElementById('le-network-status');
    if (!bar) {
        bar = document.createElement('div'); bar.id = 'le-network-status';
        bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:130px;z-index:9998;padding:9px 12px;border-radius:12px;text-align:center;font:600 12px/1.4 system-ui;box-shadow:0 4px 18px #0002;';
        document.body.appendChild(bar);
    }
    if (offline || !navigator.onLine) {
        bar.textContent = 'Mode offline • katalog dari penyimpanan terakhir; harga dan stok bisa berubah.';
        bar.style.background = '#fff3cd'; bar.style.color = '#7c4a03'; bar.hidden = false;
    } else { bar.textContent = 'Online'; bar.style.background = '#dcfce7'; bar.style.color = '#166534'; bar.hidden = true; }
}
window.addEventListener('online', () => tampilkanStatusOffline(false));
window.addEventListener('offline', () => tampilkanStatusOffline(true));

function siapkanInstalasiPWA() {
    // PWA tetap aktif, tetapi popup ajakan instalasi otomatis dinonaktifkan.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker gagal didaftarkan:', err)));
    }
}
siapkanInstalasiPWA();
perbaruiBadgeKeranjang();
window.addEventListener('storage', perbaruiBadgeKeranjang);

/* Carousel banner promosi Loji Express */
(() => {
  const track = document.getElementById('promo-track');
  if (!track) return;
  const slides = Array.from(track.children);
  const prev = document.querySelector('.promo-carousel .promo-prev');
  const next = document.querySelector('.promo-carousel .promo-next');
  let current = 0;
  let timer;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
  };
  const restart = () => {
    clearInterval(timer);
    timer = setInterval(() => show(current + 1), 5500);
  };
  prev?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    show(current - 1);
    restart();
  });
  next?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    show(current + 1);
    restart();
  });
  const mitraPopup = document.getElementById('mitra-signup-overlay');
  const bukaPopupMitra = () => {
    if (!mitraPopup) return;
    mitraPopup.classList.add('is-open');
    mitraPopup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mitra-signup-open');
    mitraPopup.querySelector('.mitra-signup-close')?.focus();
  };
  window.tutupPopupMitra = (event) => {
    if (event && event.target !== mitraPopup) return;
    if (!mitraPopup) return;
    mitraPopup.classList.remove('is-open');
    mitraPopup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mitra-signup-open');
  };
  document.querySelectorAll('[data-mitra-link]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    bukaPopupMitra();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mitraPopup?.classList.contains('is-open')) window.tutupPopupMitra();
  });
  show(0); restart();
})();
