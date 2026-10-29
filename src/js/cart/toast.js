// Výrazná bublina nahoře na obrazovce pro změny skladu — na rozdíl od
// tichého textu v souhrnu objednávky si jí zákazník všimne, ať je na
// stránce kdekoliv.
let timer = null;

export function showStockToast(message) {
  let toast = document.getElementById('stock-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'stock-toast';
    toast.className = 'stock-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 6000);
}
