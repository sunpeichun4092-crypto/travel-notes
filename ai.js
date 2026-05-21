// js/ai.js — 免费 LLM 接入（Pollinations text endpoint，无需 API key）
(function () {
  'use strict';
  const STORAGE_PREFS = 'travel-ai-prefs-v1';
  const STORAGE_REVIEW_PREFIX = 'travel-ai-review-v1:';
  const ENDPOINT = 'https://text.pollinations.ai/';

  function getPrefs() {
    try { const raw = localStorage.getItem(STORAGE_PREFS); if (!raw) return null; return JSON.parse(raw); }
    catch (e) { return null; }
  }
  function setPrefs(p) {
    localStorage.setItem(STORAGE_PREFS, JSON.stringify(p));
    Object.keys(localStorage).forEach(k => { if (k.startsWith(STORAGE_REVIEW_PREFIX)) localStorage.removeItem(k); });
  }
  function clearPrefs() {
    localStorage.removeItem(STORAGE_PREFS);
    Object.keys(localStorage).forEach(k => { if (k.startsWith(STORAGE_REVIEW_PREFIX)) localStorage.removeItem(k); });
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }
  function prefsHash(p) { if (!p) return 'default'; return hashStr(JSON.stringify(p)); }
  function prefsToText(p) {
    if (!p) return '没有特殊偏好';
    const parts = [];
    if (p.companion) parts.push('同行：' + p.companion);
    if (p.budget) parts.push('预算：' + p.budget);
    if (p.style && p.style.length) parts.push('风格：' + p.style.join('/'));
    if (p.interest && p.interest.length) parts.push('兴趣：' + p.interest.join('/'));
    if (p.pace) parts.push('节奏：' + p.pace);
    if (p.note) parts.push('备注：' + p.note);
    return parts.length ? parts.join('；') : '没有特殊偏好';
  }
  async function callLLM(systemPrompt, userPrompt) {
    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      model: 'openai',
      seed: Math.floor(Math.random() * 1e9),
    };
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('LLM ' + resp.status);
    const text = await resp.text();
    return (text || '').trim();
  }
  function placeKey(place, type) { return type + ':' + (place.name || ''); }
  async function reviewPlace(place, type, dest) {
    const prefs = getPrefs();
    const cacheKey = STORAGE_REVIEW_PREFIX + prefsHash(prefs) + ':' + placeKey(place, type);
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
    const sys = '你是一位真诚、简洁、不油腻的旅行顾问。根据用户偏好，为指定的景点/酒店/餐厅给出**一句话**点评（30-55 字）。指出与用户偏好的契合点或潜在问题，避免空话和万能模板。直接输出点评本身，不要前缀、不要引号、不要 emoji。';
    let placeStr;
    if (type === 'hotel') {
      placeStr = '酒店：' + place.name + '（' + (place.level || '中端') + '），位于 ' + dest.name + '，每晚约 ¥' + (place.pricePerNight || '?') + '。';
    } else if (type === 'food') {
      placeStr = '餐厅：' + place.name + '（' + (place.type || '当地菜') + '），位于 ' + dest.name + '，人均约 ¥' + (place.cost || '?') + '。';
    } else {
      placeStr = '景点：' + place.name + '（' + (place.tag || '热门景点') + '），位于 ' + dest.name + '，建议游览 ' + (place.hours || 2) + ' 小时' + (place.cost ? '，门票约 ¥' + place.cost : '，免费') + '。';
    }
    const usr = '用户偏好：' + prefsToText(prefs) + '\n\n' + placeStr + '\n\n请用一句中文话点评（30-55 字），直接输出。';
    const text = await callLLM(sys, usr);
    const cleaned = text.replace(/^["「『]+|["」』]+$/g, '').trim().slice(0, 80);
    if (cleaned) localStorage.setItem(cacheKey, cleaned);
    return cleaned;
  }
  window.AI = { getPrefs, setPrefs, clearPrefs, prefsToText, reviewPlace, callLLM };
})();
