// Vstupní bod JavaScriptu pro všechny veřejné stránky (sestavuje esbuild do
// assets/js/site.js). Každý modul si sám ověří, jestli na stránce má co dělat.
import { initDrawer } from './cart/drawer.js';
import { initAddToCart } from './cart/add-to-cart.js';
import { initCatalog } from './cart/catalog.js';
import { initCheckout } from './cart/checkout.js';
import { loadStock } from './cart/stock.js';
import { initNav } from './ui/nav.js';
import { initLightbox } from './ui/lightbox.js';
import { initScrollReveal } from './ui/scroll-reveal.js';
import { initContactForm } from './forms/contact.js';
import { initWithdrawalForm } from './forms/withdrawal.js';
import { initStockNotifyForms } from './forms/stock-notify.js';
import { initProductReviews } from './reviews/product-reviews.js';
import { initHomepageReviews } from './reviews/homepage-reviews.js';
import { initDynamicProductPage } from './pages/product.js';
import { initReviewPage } from './pages/review.js';

document.addEventListener('DOMContentLoaded', () => {
  initDrawer();
  initCheckout();
  initCatalog();
  initAddToCart();
  loadStock();

  initNav();
  initContactForm();
  initWithdrawalForm();
  initLightbox();
  initProductReviews();
  initHomepageReviews();
  initScrollReveal();
  initStockNotifyForms();

  initDynamicProductPage();
  initReviewPage();
});
