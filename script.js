const URL_API_GAS = "https://script.google.com/macros/s/AKfycbyz85UvAfDESNLzBvWXmxfafBVGvpg5mG12WghukOnNwIliEliJLyj6qzRXAZRjdrYh/exec";
const NOMOR_WHATSAPP_TOKO = "6283878605801"; // Semua tujuan WhatsApp toko menggunakan nomor ini // Nomor WhatsApp admin toko yang sudah digunakan checkout

/* ONGKIR GRATIS API KEY: OpenStreetMap + OSRM public demo.
 * Koordinat toko diisi dari tautan lokasi yang dikirim pemilik.
 * Catatan: server demo OSRM gratis untuk uji coba/pemakaian ringan, tanpa SLA produksi.
 */
const ONGKIR_CONFIG = {
    tokoLat: -6.5187284,
    tokoLng: 107.2301741,
    tarifPerKm: 2000,
    ongkirMinimum: 5000,
    osrmEndpoint: 'https://router.project-osrm.org/route/v1/driving'
};

let hasilOngkir = null;
let titikTujuanPengiriman = null;
let lokasiPelangganSaatIni = null;

let semuaProdukGlobal = [];

async function ambilDataProduk() {
    try {
        const respon = await fetch(URL_API_GAS);
        const data = await respon.json();
        
        if (!data.success || !data.products) {
            throw new Error(data.message || "Gagal membaca data dari server.");
        }
        
        semuaProdukGlobal = data.products; 
        inisialisasiKategori(semuaProdukGlobal);
        tampilkanProduk(semuaProdukGlobal);
    } catch (error) {
        console.error("Kesalahan API:", error);
        const grid = document.getElementById('konten-produk');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: span 2; text-align: center; padding: 30px; background: #fff; border-radius: 16px; border: 1px solid #fee2e2;">
                    <p style="color: #ef4444; font-size: 13.5px; font-weight: 700; margin: 0 0 6px 0;">⚠️ Gagal memuat data produk.</p>
                    <p style="color: var(--text-gray); font-size: 12px; margin: 0;">Pastikan akses GAS sudah diset ke "Anyone".</p>
                </div>`;
        }
    }
}

function inisialisasiKategori(daftarProduk) {
    const container = document.getElementById('kategori-container');
    if (!container) return;

    const kategoriSet = new Set();
    daftarProduk.forEach(p => {
        if (p.kategori) kategoriSet.add(String(p.kategori).trim());
    });

    let htmlButtons = `<button class="category-tab active" onclick="filterKategori('Semua', event)">Semua</button>`;
    kategoriSet.forEach(kat => {
        htmlButtons += `<button class="category-tab" onclick="filterKategori('${kat}', event)">${kat}</button>`;
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
        const respon = await fetch(URL_API_GAS);
        const data = await respon.json();
        
        if (!data.success || !data.products) {
            throw new Error("Gagal mengambil data produk.");
        }

        const produk = data.products.find(p => String(p.id) === String(idProduk));
        if (!produk) {
            alert("Produk tidak ditemukan.");
            window.location.href = 'index.html';
            return;
        }

        renderDetailHalaman(produk);
    } catch (error) {
        console.error("Error detail:", error);
        document.getElementById('detail-container').innerHTML = `<p style="text-align:center; color:red; padding:30px;">Gagal memuat detail produk.</p>`;
    }
}

function renderDetailHalaman(p) {
    const container = document.getElementById('detail-container');
    if (!container) return;

    const hargaFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.harga || 0);
    const stokVal = Number(p.stok) || 0;
    const isHabis = stokVal <= 0 || p.aktif === false || p.aktif === "FALSE" || p.aktif === "False";

    let listFoto = [];
    if (p.foto_1_url) listFoto.push(p.foto_1_url);
    if (p.foto_2_url) listFoto.push(p.foto_2_url);
    if (p.foto_3_url) listFoto.push(p.foto_3_url);
    if (listFoto.length === 0) listFoto.push('https://via.placeholder.com/400');

    let htmlThumbnails = "";
    if (listFoto.length > 1) {
        htmlThumbnails = `<div class="thumbnail-row-clean">`;
        listFoto.forEach((url, idx) => {
            htmlThumbnails += `<img src="${url}" class="thumb-clean ${idx === 0 ? 'active-thumb' : ''}" onclick="gantiFotoUtama('${url}', this)">`;
        });
        htmlThumbnails += `</div>`;
    }

    container.innerHTML = `
        <div class="detail-image-card-container">
            <div class="detail-main-card-box">
                <img src="${listFoto[0]}" id="foto-utama" class="main-img-medium" alt="${p.nama}">
                ${htmlThumbnails}
            </div>
        </div>

        <div class="detail-content-card">
            <div class="detail-badge-row">
                <span class="detail-kategori-pill">${p.kategori || 'Umum'}</span>
                <span style="font-size: 12px; font-weight: 700; color: ${isHabis ? '#ef4444' : '#16a34a'};">
                    ${isHabis ? '● Stok Habis' : '● Ready ' + stokVal + ' pcs'}
                </span>
            </div>

            <h1 class="detail-nama" style="font-size: 19px; font-weight: 800; color: var(--text-dark); margin: 0 0 8px 0;">${p.nama || 'Tanpa Nama'}</h1>
            <div class="detail-harga-tag">${hargaFormat}</div>

            <div class="detail-meta-grid">
                <div class="meta-box">
                    <span class="meta-label">ID SKU</span>
                    <span class="meta-val">#${p.id}</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">Status Produk</span>
                    <span class="meta-val">${p.aktif !== false && p.aktif !== "FALSE" ? 'Aktif Jual' : 'Non-Aktif'}</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">Urutan Katalog</span>
                    <span class="meta-val">${p.urutan || '-'}</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">Kategori</span>
                    <span class="meta-val">${p.kategori || 'Umum'}</span>
                </div>
            </div>

            <div class="detail-deskripsi-box">
                <h3>Deskripsi Produk</h3>
                <p>${p.deskripsi || 'Tidak ada deskripsi rinci untuk produk ini.'}</p>
            </div>
        </div>
    `;

    const actionBeli = document.getElementById('action-beli-container');
    if (actionBeli) {
        if (isHabis) {
            actionBeli.innerHTML = `<button class="btn-add-to-cart-modern" style="background:#cbd5e1; cursor:not-allowed; box-shadow:none;" disabled>STOK HABIS</button>`;
        } else {
            actionBeli.innerHTML = `
                <button class="btn-add-to-cart-modern" onclick='tambahKeKeranjang({id: "${p.id}", nama: "${p.nama}", harga: ${p.harga}, stok: ${p.stok}, foto: "${listFoto[0]}"})'>
                    <span class="material-icons-round">add_shopping_cart</span>
                    <span>TAMBAH KE KERANJANG</span>
                </button>
            `;
        }
    }
}

function gantiFotoUtama(url, el) {
    document.getElementById('foto-utama').src = url;
    document.querySelectorAll('.thumb-clean').forEach(img => img.classList.remove('active-thumb'));
    el.classList.add('active-thumb');
}

function toggleSearchModal() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('search-input');
    const dockNav = document.querySelector('.dock-nav');

    if (modal) {
        const isOpen = modal.style.display === 'block';
        modal.style.display = isOpen ? 'none' : 'block';
        if (dockNav) {
            dockNav.style.transform = isOpen ? 'translateY(0)' : 'translateY(150px)';
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
        const tarifPerKm = Number(ONGKIR_CONFIG.tarifPerKm);
        const ongkir = Math.max(Number(ONGKIR_CONFIG.ongkirMinimum), jarakDibulatkan * tarifPerKm);
        const jarakTeks = `${jarakKm.toFixed(1)} km`;
        const alamat = document.getElementById('alamat')?.value.trim() || '';
        hasilOngkir = {
            alamat, jarakKm, jarakTeks, jarakDibulatkan, biaya: ongkir,
            tujuanLat: titikTujuanPengiriman.lat, tujuanLng: titikTujuanPengiriman.lng
        };
        const jarakEl = document.getElementById('jarak-pengiriman');
        if (jarakEl) jarakEl.textContent = `${jarakTeks} (tarif dihitung untuk ${jarakDibulatkan} km)`;
        aturStatusOngkir(`Ongkir berhasil dihitung otomatis dari posisi GPS: Rp${tarifPerKm.toLocaleString('id-ID')}/km, minimum Rp${Number(ONGKIR_CONFIG.ongkirMinimum).toLocaleString('id-ID')}.`, 'is-success');
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
        tampilkanPopupPesanError('Ongkir belum dihitung', 'Tekan tombol lokasi dan izinkan GPS agar ongkir dihitung otomatis terlebih dahulu.');
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
    document.getElementById('wa-summary-count').textContent = `${jumlahItem} item (${keranjang.length} jenis produk)`;
    document.getElementById('wa-summary-subtotal').textContent = rupiah(subtotal);
    document.getElementById('wa-summary-distance').textContent = `${hasilOngkir.jarakTeks} (${hasilOngkir.jarakDibulatkan} km untuk tarif)`;
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
    const { keranjang, nama, alamat, subtotal, ongkir, total, jarakTeks, jarakDibulatkan, tujuanLat, tujuanLng } = dataPesananWhatsApp;
    const rincianItem = keranjang.map((item, index) => {
        const nilaiItem = (Number(item.harga) || 0) * (Number(item.jumlah) || 0);
        return `${index + 1}. ${item.nama} (${item.jumlah}x) - ${rupiah(nilaiItem)}`;
    }).join('\n');
    const teksPesan = `Halo Admin Logi Express, saya ingin memesan:\n\n` +
        `DATA PENERIMA\nNama: ${nama}\nAlamat: ${alamat}\nLokasi GPS pelanggan: https://www.google.com/maps?q=${tujuanLat},${tujuanLng}\nKoordinat tujuan: ${tujuanLat.toFixed(6)}, ${tujuanLng.toFixed(6)}\n\n` +
        `RINCIAN PESANAN\n${rincianItem}\n\n` +
        `Subtotal produk: ${rupiah(subtotal)}\n` +
        `Jarak berkendara: ${jarakTeks} (tarif dihitung untuk ${jarakDibulatkan} km)\n` +
        `Ongkir: ${rupiah(ongkir)}\n` +
        `TOTAL PEMBAYARAN: ${rupiah(total)}\n\nMohon segera diproses ya kak. Terima kasih!`;
    const urlWhatsApp = `https://wa.me/${NOMOR_WHATSAPP_TOKO}?text=${encodeURIComponent(teksPesan)}`;
    const tabWhatsApp = window.open(urlWhatsApp, '_blank');

    if (tabWhatsApp) {
        localStorage.removeItem('keranjang');
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


/* Logi Express — Pusat Bantuan */
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
        ? 'Halo Admin Logi Express, saya ingin meminta bantuan terkait pesanan.\n\nNama: \nTanggal/waktu pesanan: \nKendala: '
        : 'Halo Admin Logi Express, saya ingin bertanya tentang produk dan layanan toko.\n\nPertanyaan saya: ';
    const url = `https://wa.me/${NOMOR_WHATSAPP_TOKO}?text=${encodeURIComponent(pesan)}`;
    const tab = window.open(url, '_blank');
    if (!tab) window.location.href = url;
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        tutupPusatBantuan();
    }
});
