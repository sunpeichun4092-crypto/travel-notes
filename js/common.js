// 公共工具：导航高亮、获取自定义/示例攻略合并、URL 参数解析等
window.APP = (function () {
  const STORAGE_KEYS = {
    USER_GUIDES: 'travel_user_guides',
    TRIP_PLAN: 'travel_trip_plan',
  };

  function getUserGuides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_GUIDES) || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveUserGuides(list) {
    localStorage.setItem(STORAGE_KEYS.USER_GUIDES, JSON.stringify(list));
  }
  function getAllGuides() {
    const sample = (window.APP_DATA && window.APP_DATA.guides) || [];
    return [...getUserGuides(), ...sample];
  }
  function getDestinations() {
    return (window.APP_DATA && window.APP_DATA.destinations) || [];
  }
  function getDestinationById(id) {
    return getDestinations().find(d => d.id === id);
  }
  function getGuideById(id) {
    return getAllGuides().find(g => g.id === id);
  }

  function param(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function highlightNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
  }

  function bindMenu() {
    const btn = document.querySelector('.menu-toggle');
    const links = document.querySelector('.nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', () => links.classList.toggle('open'));
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    highlightNav();
    bindMenu();
  }
  document.addEventListener('DOMContentLoaded', init);

  return {
    STORAGE_KEYS,
    getUserGuides,
    saveUserGuides,
    getAllGuides,
    getDestinations,
    getDestinationById,
    getGuideById,
    param,
    toast,
    escapeHtml,
  };
})();
