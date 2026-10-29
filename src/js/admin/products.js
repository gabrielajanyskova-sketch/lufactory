// Záložka Produkty a sklad — karty se skladem, editor produktu, fotky.
import { API_BASE, adminFetch, adminJson } from './api.js';
import { escapeHtml } from '../util.js';

const $ = (id) => document.getElementById(id);

let currentProducts = {};
let modalMode = 'new';
let modalProductId = null;
let modalPhotoFile = null;
let editorGalleryUrls = [];
let editorMainImageUrl = '';

const productPath = (id) => '/api/admin/products/' + encodeURIComponent(id);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function uploadProductPhoto(productId, file, target) {
  return fileToBase64(file).then((base64) =>
    adminFetch(productPath(productId) + '/image', {
      method: 'POST',
      body: { contentBase64: base64, contentType: file.type, target }
    })
  );
}

function buildProductCard(productId, p) {
  const card = document.createElement('div');
  card.className = 'product-admin-card';
  card.innerHTML =
    '<div class="product-admin-card-body">' +
      '<h4>' + escapeHtml(p.title) + '</h4>' +
      '<p>' + p.price + ' Kč</p>' +
    '</div>' +
    '<div class="admin-stock-control' + (p.stockQty > 0 ? '' : ' stock-empty') + '">' +
      '<button type="button" data-stock-dec aria-label="Ubrat kus">−</button>' +
      '<input type="number" min="0" value="' + p.stockQty + '" data-stock-input aria-label="Počet kusů skladem">' +
      '<button type="button" data-stock-inc aria-label="Přidat kus">+</button>' +
    '</div>' +
    '<button type="button" class="gallery-remove-btn product-admin-card-delete" title="Smazat produkt">✕</button>';
  card.addEventListener('click', () => { openProductEditor(productId); });

  const stockInput = card.querySelector('[data-stock-input]');
  const stockControl = card.querySelector('.admin-stock-control');
  function saveStock(newQty) {
    newQty = Math.max(0, newQty);
    stockInput.value = newQty;
    stockControl.classList.toggle('stock-empty', newQty === 0);
    currentProducts[productId].stockQty = newQty;
    adminFetch(productPath(productId), { method: 'PATCH', body: { stockQty: newQty } });
  }
  card.querySelector('[data-stock-dec]').addEventListener('click', (e) => {
    e.stopPropagation();
    saveStock((parseInt(stockInput.value, 10) || 0) - 1);
  });
  card.querySelector('[data-stock-inc]').addEventListener('click', (e) => {
    e.stopPropagation();
    saveStock((parseInt(stockInput.value, 10) || 0) + 1);
  });
  stockInput.addEventListener('click', (e) => { e.stopPropagation(); });
  stockInput.addEventListener('change', () => {
    saveStock(parseInt(stockInput.value, 10) || 0);
  });

  card.querySelector('.product-admin-card-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Opravdu smazat produkt "' + p.title + '"? Nejde vrátit zpět.')) return;
    adminFetch(productPath(productId), { method: 'DELETE' }).then(() => { loadProducts(); });
  });
  return card;
}

export function loadProducts() {
  fetch(API_BASE + '/api/products')
    .then((r) => r.json())
    .then((products) => {
      currentProducts = products;
      const grid = $('products-cards');
      grid.innerHTML = '';
      Object.keys(products).forEach((productId) => {
        grid.appendChild(buildProductCard(productId, products[productId]));
      });
    });
}

function showEditorImage(src) {
  const img = $('editor-img');
  if (src) {
    img.src = src;
    img.hidden = false;
    $('editor-img-placeholder').hidden = true;
  } else {
    img.hidden = true;
    $('editor-img-placeholder').hidden = false;
  }
}

function openProductEditor(productId) {
  modalMode = productId ? 'edit' : 'new';
  modalProductId = productId;
  modalPhotoFile = null;
  $('editor-photo-input').value = '';

  const idInput = $('editor-id');
  const stockBadge = $('editor-stock-badge');
  const p = modalMode === 'edit' ? currentProducts[productId] : { title: '', price: '', stockQty: 0 };

  idInput.value = productId || '';
  idInput.disabled = modalMode === 'edit';
  $('editor-id-group').hidden = modalMode === 'edit';
  $('editor-title').value = p.title;
  $('editor-description').value = p.description || '';
  $('editor-teaser').value = p.teaser || '';
  $('editor-price').value = p.price;
  $('editor-stock').value = p.stockQty;
  editorMainImageUrl = p.imageUrl || '';
  showEditorImage(p.imageUrl);
  stockBadge.textContent = p.stockQty > 0 ? 'Skladem: ' + p.stockQty + ' ks' : 'Není skladem';
  stockBadge.className = 'stock-badge ' + (p.stockQty > 0 ? 'stock-badge--in' : 'stock-badge--out');
  editorGalleryUrls = (p.galleryUrls || []).slice();

  renderEditorGallery();
  updateDescriptionCount();
  $('editor-msg').textContent = '';
  $('products-list-view').hidden = true;
  $('product-editor').hidden = false;
}

function renderEditorGallery() {
  const gallery = $('editor-gallery');
  gallery.innerHTML = '';
  editorGalleryUrls.forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'editor-gallery-item';
    item.innerHTML =
      '<img src="' + escapeHtml(url) + '" alt="" title="Nastavit jako hlavní fotku">' +
      '<button type="button" class="gallery-remove-btn" title="Smazat fotku">✕</button>';
    item.querySelector('img').addEventListener('click', () => {
      setAsMainImage(index);
    });
    item.querySelector('.gallery-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      editorGalleryUrls.splice(index, 1);
      saveGalleryUrls();
    });
    gallery.appendChild(item);
  });

  if (modalMode === 'edit') {
    const addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.className = 'editor-gallery-add';
    addTile.textContent = '+ Přidat fotku';
    addTile.addEventListener('click', () => {
      $('editor-gallery-input').click();
    });
    gallery.appendChild(addTile);
  }
}

function saveGalleryUrls() {
  return adminFetch(productPath(modalProductId), { method: 'PATCH', body: { galleryUrls: editorGalleryUrls } })
    .then(() => { renderEditorGallery(); });
}

function setAsMainImage(galleryIndex) {
  const newMain = editorGalleryUrls[galleryIndex];
  const oldMain = editorMainImageUrl;
  editorGalleryUrls.splice(galleryIndex, 1);
  if (oldMain) editorGalleryUrls.push(oldMain);
  editorMainImageUrl = newMain;
  showEditorImage(newMain);

  return adminFetch(productPath(modalProductId), { method: 'PATCH', body: { imageUrl: newMain, galleryUrls: editorGalleryUrls } })
    .then(() => { renderEditorGallery(); });
}

function closeProductEditor() {
  $('product-editor').hidden = true;
  $('products-list-view').hidden = false;
}

function updateDescriptionCount() {
  $('editor-description-count').textContent = $('editor-description').value.length + ' / 1000 znaků';
}

function saveProduct() {
  const msg = $('editor-msg');
  const saveBtn = $('editor-save');
  const payload = {
    title: $('editor-title').value.trim(),
    description: $('editor-description').value.trim(),
    teaser: $('editor-teaser').value.trim(),
    price: Number($('editor-price').value),
    stockQty: Number($('editor-stock').value) || 0
  };

  const productId = modalMode === 'new' ? $('editor-id').value.trim() : modalProductId;
  if (!productId || !payload.title || payload.price == null || isNaN(payload.price)) {
    msg.textContent = 'Vyplňte aspoň ID, název a cenu.';
    msg.className = 'status-msg err';
    return;
  }

  saveBtn.textContent = 'Ukládám…';
  const request = modalMode === 'new'
    ? adminJson('/api/admin/products', { method: 'POST', body: Object.assign({ productId }, payload) })
    : adminJson(productPath(productId), { method: 'PATCH', body: payload });

  request
    .then((res) => {
      if (!res.ok) throw new Error(res.data.error || 'chyba');
      return modalPhotoFile ? uploadProductPhoto(productId, modalPhotoFile) : null;
    })
    .then(() => {
      saveBtn.textContent = 'Uložit';
      closeProductEditor();
      loadProducts();
    })
    .catch((err) => {
      saveBtn.textContent = 'Uložit';
      msg.textContent = 'Nepodařilo se uložit (' + err.message + ').';
      msg.className = 'status-msg err';
    });
}

export function initProducts() {
  $('editor-gallery-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !modalProductId) return;
    uploadProductPhoto(modalProductId, file, 'gallery')
      .then((r) => r.json())
      .then((data) => {
        editorGalleryUrls.push(data.imageUrl);
        renderEditorGallery();
      });
    e.target.value = '';
  });

  $('open-add-product').addEventListener('click', () => { openProductEditor(null); });
  $('editor-cancel').addEventListener('click', closeProductEditor);
  $('editor-back').addEventListener('click', (e) => {
    e.preventDefault();
    closeProductEditor();
  });

  $('editor-photo-input').addEventListener('change', (e) => {
    modalPhotoFile = e.target.files[0] || null;
    if (!modalPhotoFile) return;
    const reader = new FileReader();
    reader.onload = () => { showEditorImage(reader.result); };
    reader.readAsDataURL(modalPhotoFile);
  });

  $('editor-description').addEventListener('input', updateDescriptionCount);
  $('editor-save').addEventListener('click', saveProduct);
}
