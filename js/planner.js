// 智能行程规划：LBS 出发地 + 去程交通推荐 + 每日最优路线 + Leaflet 地图联动 + 详情抽屉
(function () {
  // ============= 常量与数据 =============
  const VISA_LABELS = {
    'visa-free': { label: '免签', tone: 'green', tip: '无需提前办理签证。' },
    'landing': { label: '落地签', tone: 'amber', tip: '需在抵达机场办理落地签 (Visa on Arrival)。' },
    'visa': { label: '需提前签证', tone: 'red', tip: '请提前申请该国签证。' },
  };

  // 主要城市 IATA 机场代码（用于航班搜索链接）
  const IATA = {
    '北京': 'PEK', '上海': 'PVG', '广州': 'CAN', '深圳': 'SZX', '成都': 'CTU',
    '杭州': 'HGH', '南京': 'NKG', '武汉': 'WUH', '西安': 'XIY', '重庆': 'CKG',
    '昆明': 'KMG', '青岛': 'TAO', '厦门': 'XMN', '长沙': 'CSX', '郑州': 'CGO',
    '香港': 'HKG', '台北': 'TPE', '东京': 'HND', '大阪': 'KIX', '首尔': 'ICN',
    '曼谷': 'BKK', '新加坡': 'SIN', '吉隆坡': 'KUL', '巴厘岛': 'DPS', '雅加达': 'CGK',
    '巴黎': 'CDG', '伦敦': 'LHR', '罗马': 'FCO', '马德里': 'MAD', '阿姆斯特丹': 'AMS',
    '法兰克福': 'FRA', '苏黎世': 'ZRH', '雷克雅未克': 'KEF',
    '纽约': 'JFK', '洛杉矶': 'LAX', '旧金山': 'SFO', '芝加哥': 'ORD', '多伦多': 'YYZ',
    '京都': 'KIX', '开普敦': 'CPT',
  };

  // 目的地 → IATA（兜底映射）
  const DEST_IATA = {
    tokyo: 'HND', kyoto: 'KIX', paris: 'CDG', bali: 'DPS', bangkok: 'BKK',
    chengdu: 'CTU', reykjavik: 'KEF', newyork: 'JFK',
  };

  // ============= DOM 引用 =============
  const $form = document.getElementById('plannerForm');
  const $dest = document.getElementById('destSel');
  const $start = document.getElementById('startDate');
  const $days = document.getElementById('days');
  const $budget = document.getElementById('budget');
  const $visaPills = document.getElementById('visaPills');
  const $visaTip = document.getElementById('visaTip');
  const $result = document.getElementById('resultArea');
  const $originInput = document.getElementById('originInput');
  const $originStatus = document.getElementById('originStatus');
  const $drawer = document.getElementById('drawer');
  const $drawerMask = document.getElementById('drawerMask');
  const $drawerTitle = document.getElementById('drawerTitle');
  const $drawerBody = document.getElementById('drawerBody');

  let visaFilter = 'any';
  let origin = null; // { name, lat, lng }
  let leafletMap = null;
  let mapMarkers = [];   // { id, marker, item }
  let routeLayer = null;
  let activeItemId = null;
  let currentPlan = null;
  let currentTravel = null;

  // ============= 初始化 =============
  (function initDate() {
    const t = new Date();
    t.setDate(t.getDate() + 14);
    $start.value = t.toISOString().slice(0, 10);
  })();

  function fillDest() {
    $dest.innerHTML = '';
    APP.getDestinations().forEach(d => {
      if (visaFilter !== 'any' && d.visa !== visaFilter) return;
      const o = document.createElement('option');
      o.value = d.id;
      const v = VISA_LABELS[d.visa] || { label: '' };
      o.textContent = `${d.name} · ${d.country}（${v.label}）`;
      $dest.appendChild(o);
    });
    if (!$dest.options.length) {
      const o = document.createElement('option');
      o.disabled = true; o.textContent = '当前条件下无匹配目的地';
      $dest.appendChild(o);
    }
    showVisaTip();
  }
  function showVisaTip() {
    const dest = APP.getDestinationById($dest.value);
    if (!dest) { $visaTip.classList.remove('show'); return; }
    const info = VISA_LABELS[dest.visa];
    $visaTip.className = 'visa-tip show ' + info.tone;
    $visaTip.textContent = `${dest.name}（${dest.country}）：${info.label} — ${dest.visaNote || info.tip}`;
  }
  $visaPills.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      $visaPills.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      visaFilter = btn.dataset.visa;
      fillDest();
    });
  });
  $dest.addEventListener('change', showVisaTip);
  fillDest();

  // ============= LBS 定位 =============
  // 浏览器 geolocation 限制：file:// 协议、http (非 localhost) 都无法使用，必须 https 或 localhost
  function isSecureGeoContext() {
    if (location.protocol === 'https:') return true;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
    return false;
  }

  window.locateMe = async function () {
    // 第一步：检查 secure context
    if (!isSecureGeoContext()) {
      setOriginStatus(
        location.protocol === 'file:'
          ? '⚠️ 浏览器不允许在 file:// 下使用定位。请用 http://localhost 打开（终端运行：python3 -m http.server）。下面尝试通过 IP 进行粗略定位…'
          : '⚠️ 当前不是安全上下文（需 https 或 localhost）。下面尝试通过 IP 进行粗略定位…',
        'err'
      );
      const fb = await ipFallbackLocate();
      if (fb) {
        origin = fb;
        $originInput.value = fb.name;
        setOriginStatus(`✅ 已通过 IP 粗略定位：${fb.name}（精度较低，可手动调整）`, 'ok');
      }
      return;
    }
    if (!navigator.geolocation) {
      setOriginStatus('当前浏览器不支持地理定位，下面尝试 IP 兜底…', 'err');
      const fb = await ipFallbackLocate();
      if (fb) {
        origin = fb; $originInput.value = fb.name;
        setOriginStatus(`✅ IP 粗略定位：${fb.name}`, 'ok');
      }
      return;
    }

    setOriginStatus('正在获取位置（首次需在浏览器弹窗中允许定位）…', '');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setOriginStatus(`已获取经纬度 (${latitude.toFixed(3)}, ${longitude.toFixed(3)})，正在解析地名…`, '');
        const place = await reverseGeocode(latitude, longitude);
        origin = {
          name: place || `(${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
          lat: latitude, lng: longitude,
        };
        $originInput.value = origin.name;
        setOriginStatus(`✅ 已定位：${origin.name}`, 'ok');
      },
      async (err) => {
        let msg = '';
        switch (err.code) {
          case 1: msg = '你拒绝了定位权限，请在浏览器地址栏左侧的"🔒 / ⓘ"图标里允许位置访问，或手动输入城市。'; break;
          case 2: msg = '系统定位服务不可用（可能是断网或系统未开启定位）。下面尝试 IP 兜底…'; break;
          case 3: msg = '定位超时。下面尝试 IP 兜底…'; break;
          default: msg = `定位失败：${err.message || '未知错误'}`;
        }
        setOriginStatus('⚠️ ' + msg, 'err');
        if (err.code !== 1) {
          const fb = await ipFallbackLocate();
          if (fb) {
            origin = fb; $originInput.value = fb.name;
            setOriginStatus(`✅ IP 粗略定位：${fb.name}（精度较低，可手动调整）`, 'ok');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // IP 兜底（多个免费 IP 定位服务，逐个尝试）
  async function ipFallbackLocate() {
    const providers = [
      async () => {
        const r = await fetch('https://ipapi.co/json/');
        const j = await r.json();
        if (j && j.latitude) {
          const name = [j.city, j.region, j.country_name].filter(Boolean).join(' · ');
          return { name: name || `${j.latitude}, ${j.longitude}`, lat: j.latitude, lng: j.longitude };
        }
        return null;
      },
      async () => {
        const r = await fetch('https://ipwho.is/');
        const j = await r.json();
        if (j && j.success && j.latitude) {
          const name = [j.city, j.region, j.country].filter(Boolean).join(' · ');
          return { name, lat: j.latitude, lng: j.longitude };
        }
        return null;
      },
    ];
    for (const p of providers) {
      try {
        const r = await p();
        if (r) return r;
      } catch (e) { /* 继续下一个 */ }
    }
    return null;
  }

  window.resolveOriginInput = async function () {
    const q = $originInput.value.trim();
    if (!q) { setOriginStatus('请先在输入框中填写出发城市或地址。', 'err'); return; }
    setOriginStatus('正在解析输入位置…', '');
    const r = await forwardGeocode(q);
    if (!r) {
      setOriginStatus(`无法解析"${q}"，请尝试更精确的城市名。`, 'err');
      return;
    }
    origin = r;
    $originInput.value = r.name;
    setOriginStatus(`✅ 已设定出发地：${r.name}`, 'ok');
  };

  function setOriginStatus(text, level) {
    $originStatus.textContent = text;
    $originStatus.className = 'origin-status' + (level ? ' ' + level : '');
  }

  // Nominatim 反向地理编码（公共服务，无需 key，但请勿高频调用）
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN`);
      const j = await res.json();
      const a = j.address || {};
      return [a.city || a.town || a.village || a.county, a.state, a.country].filter(Boolean).join(' · ');
    } catch (e) { return null; }
  }
  async function forwardGeocode(q) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&accept-language=zh-CN&limit=1`);
      const arr = await res.json();
      if (!arr.length) return null;
      const x = arr[0];
      return { name: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) };
    } catch (e) { return null; }
  }

  // ============= 工具 =============
  function dateOffset(start, n) {
    const d = new Date(start); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmtMoney(v) { return '¥' + Math.round(v).toLocaleString(); }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }
  // Haversine 距离（km）
  function haversine(a, b) {
    const R = 6371;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // 最近邻 TSP（开放路径，从 hotel 起，hotel 终）
  function nearestNeighborOrder(start, points) {
    const remaining = points.slice();
    const order = [];
    let cur = start;
    while (remaining.length) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(cur, remaining[i].coord);
        if (d < bestD) { bestD = d; best = i; }
      }
      order.push(remaining[best]);
      cur = remaining[best].coord;
      remaining.splice(best, 1);
    }
    return order;
  }

  // ============= 介绍/预订链接生成 =============
  function destCity(dest) { return dest.name; }

  // 描述文本回退：基于 tag 自动生成
  function genDesc(item, type, dest) {
    if (item.desc) return item.desc;
    if (type === 'sight') {
      const map = {
        '文化': `${item.name} 是 ${dest.name} 极具代表性的文化地标，可深入感受当地宗教与历史氛围。建议安排约 ${item.hours || 2} 小时游览。`,
        '艺术': `${item.name} 收藏丰富的艺术作品，是 ${dest.name} 不容错过的人文体验。建议预留 ${item.hours || 2} 小时静心欣赏。`,
        '自然': `${item.name} 让人远离城市喧嚣，是 ${dest.name} 知名的自然景观，适合拍照与漫步。`,
        '都市': `${item.name} 展现 ${dest.name} 现代化都市风貌，是体验城市脉搏的最佳地点。`,
        '购物': `${item.name} 汇聚潮流品牌与本地特产，是购物与品尝特色小吃的好去处。`,
        '美食': `${item.name} 是 ${dest.name} 的地道美食地标，可一次品尝多种当地风味。`,
        '夜市': `${item.name} 在夜间灯火通明，集街边美食、手作摊位与现场表演于一体。`,
        '海滩': `${item.name} 拥有细软沙滩与碧蓝海水，适合冲浪、日落与海鲜大餐。`,
        '地标': `${item.name} 是 ${dest.name} 最具辨识度的地标之一，几乎是行程必访点。`,
        '历史': `${item.name} 承载着 ${dest.name} 厚重的历史，适合慢慢走、细细看。`,
        '观景': `${item.name} 是俯瞰 ${dest.name} 全景的绝佳观景点，黄昏与夜景尤为推荐。`,
        '亲子': `${item.name} 适合全家同游，互动体验丰富，孩子接受度高。`,
        '温泉': `${item.name} 让你在火山地貌中感受地热温泉的舒缓，需提前预约场次。`,
      };
      return map[item.tag] || `${item.name} 是 ${dest.name} 推荐景点之一，建议预留约 ${item.hours || 2} 小时。`;
    }
    if (type === 'food') {
      return `${item.name} 主打 ${item.type || '当地美食'}，人均约 ${fmtMoney(item.cost || 0)}，是 ${dest.name} 颇有口碑的就餐选择。`;
    }
    if (type === 'hotel') {
      return `${item.name}（${item.level || '舒适'}）位于 ${dest.name}，每晚约 ${fmtMoney(item.pricePerNight || 0)}，地理位置便利，适合作为整段旅程的住宿基地。`;
    }
    return '';
  }

  // 通用预订链接（不依赖 API）
  function bookingLinks(item, type, dest) {
    const q = encodeURIComponent(`${item.name} ${dest ? dest.name : ''}`);
    const links = [];
    if (type === 'sight') {
      links.push({ label: '🎟️ Klook 查门票', url: `https://www.klook.com/zh-CN/search/?keyword=${q}` });
      links.push({ label: '🎫 KKday', url: `https://www.kkday.com/zh-cn/search?keyword=${q}` });
      links.push({ label: '🌐 官网/谷歌', url: `https://www.google.com/search?q=${q}+官网+门票` });
      links.push({ label: '📍 在 Google 地图打开', url: `https://www.google.com/maps/search/?api=1&query=${q}` });
    } else if (type === 'food') {
      links.push({ label: '🍴 大众点评', url: `https://www.dianping.com/search/keyword/0_0_${q}` });
      links.push({ label: '🥢 美团', url: `https://www.meituan.com/s/?searchText=${q}` });
      links.push({ label: '⭐ Tripadvisor', url: `https://www.tripadvisor.com/Search?q=${q}` });
      links.push({ label: '📍 在 Google 地图打开', url: `https://www.google.com/maps/search/?api=1&query=${q}` });
    } else if (type === 'hotel') {
      links.push({ label: '🏨 Booking', url: `https://www.booking.com/search.html?ss=${q}` });
      links.push({ label: '🛏️ 携程 Trip.com', url: `https://hotels.trip.com/hotels/list?city=${encodeURIComponent(dest.name)}&kw=${q}` });
      links.push({ label: '🪟 Agoda', url: `https://www.agoda.com/search?q=${q}` });
      links.push({ label: '🗺️ Airbnb', url: `https://www.airbnb.com/s/${encodeURIComponent(item.name)}` });
    } else if (type === 'transport') {
      // 交通条目：链接到本地公交查询
      links.push({ label: '🚇 Google Maps 公交', url: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=transit` });
      links.push({ label: '🚖 Uber/Bolt', url: `https://www.google.com/search?q=ride+hailing+${q}` });
    }
    return links;
  }

  // ============= 去程/返程交通方案 =============
  // direction: 'outbound' | 'return'
  function buildTravelOptions(originPt, dest, direction, date) {
    const dist = haversine(originPt, dest.coord);
    const originName = originPt.name.split('·')[0].trim() || originPt.name;
    const destName = dest.name;
    // 返程时 from/to 互换
    const fromName = direction === 'return' ? destName : originName;
    const toName = direction === 'return' ? originName : destName;
    const fromCoord = direction === 'return' ? dest.coord : originPt;
    const toCoord = direction === 'return' ? originPt : dest.coord;
    const fromIATA = direction === 'return' ? (DEST_IATA[dest.id] || IATA[destName]) : (IATA[originName] || guessIATA(originName));
    const toIATA = direction === 'return' ? (IATA[originName] || guessIATA(originName)) : (DEST_IATA[dest.id] || IATA[destName]);

    const options = [];
    // 飞机
    options.push({
      type: 'flight',
      title: '✈️ 飞机',
      eta: dist > 1500 ? '推荐' : (dist > 500 ? '可选' : '不建议'),
      recommended: dist >= 800,
      desc: `${fromName} → ${toName}，约 ${Math.round(dist)} km，飞行 ${Math.max(1, Math.round(dist / 800))} 小时左右。`,
      bookings: [
        { label: 'Skyscanner', url: `https://www.skyscanner.net/transport/flights/${fromIATA || fromName}/${toIATA || toName}/${(date || '').replace(/-/g, '')}/` },
        { label: '携程 Trip.com', url: `https://flights.ctrip.com/online/list/oneway-${fromIATA || ''}-${toIATA || ''}?_=1&depdate=${date}` },
        { label: 'Google Flights', url: `https://www.google.com/travel/flights?q=Flights+from+${encodeURIComponent(fromName)}+to+${encodeURIComponent(toName)}+on+${date}` },
        { label: 'Kayak', url: `https://www.kayak.com/flights/${fromIATA || fromName}-${toIATA || toName}/${date}` },
      ],
    });
    // 高铁/火车
    const sameCountry = (origin.name || '').includes(dest.country) || dest.country === '中国';
    options.push({
      type: 'train',
      title: '🚄 高铁 / 火车',
      eta: (dist > 100 && dist < 1800 && sameCountry) ? '推荐' : (dist <= 100 ? '不需要' : '远距离不便'),
      recommended: dist >= 200 && dist <= 1200 && sameCountry,
      desc: sameCountry
        ? `约 ${Math.round(dist)} km，估算车程 ${Math.max(1, Math.round(dist / 250))} 小时（按 250 km/h 估算）。`
        : `跨国/跨海距离，火车通常不可达。`,
      bookings: [
        { label: '12306（中国）', url: `https://kyfw.12306.cn/otn/leftTicket/init?fromStation=${encodeURIComponent(fromName)}&toStation=${encodeURIComponent(toName)}&date=${date}` },
        { label: '携程火车票', url: `https://trains.ctrip.com/trainbooking/?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}&day=${date}` },
        { label: 'Trainline (欧洲)', url: `https://www.thetrainline.com/book/results?origin=${encodeURIComponent(fromName)}&destination=${encodeURIComponent(toName)}&outwardDate=${date}` },
      ],
    });
    // 自驾
    options.push({
      type: 'drive',
      title: '🚗 自驾',
      eta: dist < 600 ? '推荐' : (dist < 1500 ? '可选' : '过远不建议'),
      recommended: dist > 0 && dist < 500,
      desc: `约 ${Math.round(dist)} km，平均车速 90 km/h 估算 ${Math.max(1, Math.round(dist / 90))} 小时。请关注路况与限行。`,
      bookings: [
        { label: 'Google Maps 路线', url: `https://www.google.com/maps/dir/?api=1&origin=${fromCoord.lat},${fromCoord.lng}&destination=${toCoord.lat},${toCoord.lng}&travelmode=driving` },
        { label: '高德导航', url: `https://uri.amap.com/navigation?from=${fromCoord.lng},${fromCoord.lat}&to=${toCoord.lng},${toCoord.lat}&mode=car&src=mypage` },
        { label: '租车 Hertz', url: `https://www.hertz.com/rentacar/reservation/` },
      ],
    });
    return { dist, options, direction, date, fromName, toName };
  }
  function guessIATA(name) {
    for (const k in IATA) if (name.includes(k)) return IATA[k];
    return '';
  }

  // ============= 行程构建（每日最优路径） =============
  function buildPlan(destId, days, totalBudget, startDate) {
    const dest = APP.getDestinationById(destId);
    if (!dest) return null;

    // 预算分配
    const split = { hotel: .35, food: .25, sight: .20, transport: .15, misc: .05 };
    const dailyHotel = (totalBudget * split.hotel) / days;
    const dailyFood = (totalBudget * split.food) / days;
    const dailySight = (totalBudget * split.sight) / days;
    const dailyTransport = (totalBudget * split.transport) / days;

    // 选择酒店（最贴近预算者）
    const hotels = (dest.hotels || []).slice().sort((a, b) => Math.abs(a.pricePerNight - dailyHotel) - Math.abs(b.pricePerNight - dailyHotel));
    const chosenHotel = hotels[0];

    // 景点：每日 2~3 个，按总数均分
    const allAttractions = shuffle(dest.attractions || []);
    const perDayCount = Math.min(3, Math.max(2, Math.floor(dailySight / 80)));
    const itinerary = [];

    let attrIdx = 0;
    const allRestaurants = (dest.restaurants || []).slice();
    const originName = origin ? (origin.name.split('·')[0].trim() || origin.name) : '出发地';

    // 第一/最后一天景点更少（被去/返程占用半天）；一日往返只安排 1 个核心景点
    const dayAttrNeed = (isFirst, isLast) => {
      if (isFirst && isLast) return 1;
      if (isFirst || isLast) return Math.min(2, Math.max(1, perDayCount - 1));
      return perDayCount;
    };

    for (let i = 0; i < days; i++) {
      const isFirst = i === 0;
      const isLast = i === days - 1;
      const oneDay = isFirst && isLast;
      const need = dayAttrNeed(isFirst, isLast);

      // 抽取本日景点
      const dayAttr = [];
      for (let k = 0; k < need && attrIdx < allAttractions.length; k++) {
        dayAttr.push(allAttractions[attrIdx++]);
      }
      while (dayAttr.length < need) {
        dayAttr.push(allAttractions[(attrIdx++) % allAttractions.length]);
      }

      // 用最近邻 TSP 重排（从酒店出发）
      const orderedAttr = nearestNeighborOrder(chosenHotel.coord, dayAttr);

      // 餐厅匹配
      const usedRest = new Set();
      const findNearest = (anchor) => {
        const cand = allRestaurants
          .filter(r => !usedRest.has(r.name))
          .map(r => ({ r, d: haversine(anchor, r.coord) }))
          .sort((a, b) => a.d - b.d);
        const pick = cand[0] ? cand[0].r : allRestaurants[0];
        usedRest.add(pick.name);
        return pick;
      };

      const items = [];
      const transportNote = transportIcon(dest);
      const pushItem = (data) => {
        data.id = `d${i + 1}-i${items.length + 1}`;
        items.push(data);
      };

      // ====== 1. 去程（第一天上午）======
      if (isFirst) {
        pushItem({
          type: 'transport', icon: '🛫', label: '去程交通',
          time: '上午出发 · 中午前后抵达',
          name: `${originName} → ${dest.name}`,
          ref: { name: `${originName} → ${dest.name}`, info: ['详见上方"去程"卡片，可一键跳转 Skyscanner / 携程 / Google Flights / 12306 等订票'] },
          meta: '飞机 / 高铁 / 自驾，详见上方"去程"卡片',
          cost: 0, coord: null,
        });
      } else {
        // 上午景点
        const a = orderedAttr[0];
        pushItem({
          type: 'sight', icon: '🎯', label: '上午景点',
          time: '09:00 - 11:30',
          name: a.name, ref: a,
          meta: `${a.tag || '热门景点'} · 约 ${a.hours} 小时`,
          cost: a.cost || 0, coord: a.coord,
        });
      }

      // ====== 2. 午餐 ======
      const lunchAnchor = (isFirst ? orderedAttr[0] : orderedAttr[0]).coord;
      const lunch = findNearest(lunchAnchor);
      pushItem({
        type: 'food', icon: '🍜', label: '午餐',
        time: isFirst ? '12:30 - 14:00' : '12:00 - 13:30',
        name: lunch.name, ref: lunch,
        meta: lunch.type, cost: lunch.cost, coord: lunch.coord,
      });

      // ====== 3. 下午景点 ======
      // 第一天用 orderedAttr[0]（抵达后唯一一个）；其它天用 orderedAttr[1] 或 orderedAttr[0] 兜底
      const afternoonAttr = isFirst ? orderedAttr[0] : (orderedAttr[1] || orderedAttr[0]);
      if (afternoonAttr) {
        pushItem({
          type: 'sight', icon: '🏛️', label: isFirst ? '下午景点（抵达后）' : '下午景点',
          time: isFirst ? '14:30 - 17:00' : '14:00 - 17:00',
          name: afternoonAttr.name, ref: afternoonAttr,
          meta: `${afternoonAttr.tag || '热门景点'} · 约 ${afternoonAttr.hours} 小时`,
          cost: afternoonAttr.cost || 0, coord: afternoonAttr.coord,
        });
      }

      if (isLast) {
        // ====== 4a. 返程（最后一天傍晚）======
        pushItem({
          type: 'transport', icon: '🛬', label: '返程交通',
          time: '傍晚出发 · 夜间到家',
          name: `${dest.name} → ${originName}`,
          ref: { name: `${dest.name} → ${originName}`, info: ['详见上方"返程"卡片，可一键跳转 Skyscanner / 携程 / Google Flights / 12306 等订票'] },
          meta: '飞机 / 高铁 / 自驾，详见上方"返程"卡片',
          cost: 0, coord: null,
        });
      } else {
        // ====== 4b. 傍晚活动（中间天，仅当有第三个景点）======
        if (orderedAttr[2]) {
          const a = orderedAttr[2];
          pushItem({
            type: 'sight', icon: '🌆', label: '傍晚活动',
            time: '17:30 - 19:00',
            name: a.name, ref: a,
            meta: `${a.tag || '热门景点'} · 约 ${a.hours} 小时`,
            cost: a.cost || 0, coord: a.coord,
          });
        }
        // ====== 5. 晚餐 ======
        const dinner = findNearest(orderedAttr[orderedAttr.length - 1].coord);
        pushItem({
          type: 'food', icon: '🍽️', label: '晚餐',
          time: isFirst ? '18:30 - 20:00' : '19:30 - 21:00',
          name: dinner.name, ref: dinner,
          meta: dinner.type, cost: dinner.cost, coord: dinner.coord,
        });
        // ====== 6. 住宿（最后一天不需要）======
        pushItem({
          type: 'hotel', icon: '🛏️', label: '住宿',
          time: isFirst ? '20:30 入住' : '21:30 入住',
          name: chosenHotel.name, ref: chosenHotel,
          meta: chosenHotel.level, cost: chosenHotel.pricePerNight, coord: chosenHotel.coord,
        });
      }

      // ====== 7. 当地交通 ======
      pushItem({
        type: 'transport', icon: '🚇', label: '城内交通',
        time: '全天',
        name: transportNote, ref: { name: transportNote, info: dest.transport },
        meta: dest.transport ? dest.transport[0] : '当地公共交通',
        cost: Math.round(dailyTransport), coord: null,
      });

      const dayCost = items.reduce((s, it) => s + (it.cost || 0), 0);
      // 当日总里程（基于按时间顺序的 coord）
      const coordSeq = items.filter(it => it.coord).map(it => it.coord);
      let totalKm = 0;
      for (let k = 1; k < coordSeq.length; k++) totalKm += haversine(coordSeq[k - 1], coordSeq[k]);

      itinerary.push({
        day: i + 1,
        date: dateOffset(startDate, i),
        items, total: dayCost, totalKm,
        isFirst, isLast,
      });
    }

    return { dest, days, totalBudget, hotel: chosenHotel, itinerary, startDate, runningTotal: itinerary.reduce((s, d) => s + d.total, 0) };
  }
  function transportIcon(d) {
    if (d.country === '中国') return '地铁/打车';
    if (['日本', '法国', '美国', '英国'].includes(d.country)) return '地铁/电车';
    if (d.id === 'reykjavik') return '自驾';
    if (d.id === 'bali') return '网约车 Grab/Gojek';
    return '当地公共交通 / 网约车';
  }

  // ============= 渲染结果 =============
  function renderPlan(plan, travel) {
    if (!plan) {
      $result.innerHTML = '<div class="placeholder-result"><div class="emoji">⚠️</div><p>无法生成行程，请检查所选目的地。</p></div>';
      return;
    }
    currentPlan = plan;
    currentTravel = travel;
    const dest = plan.dest;
    const visa = VISA_LABELS[dest.visa] || {};
    const overspend = plan.runningTotal > plan.totalBudget;

    const originShort = origin.name.split('·')[0].trim() || origin.name;
    // 概览
    let html = `
      <div class="result-summary">
        <div class="stat-card">
          <div class="label">出发地</div>
          <div class="value">${APP.escapeHtml(originShort)}</div>
          <div class="sub">${APP.escapeHtml(origin.name)}</div>
        </div>
        <div class="stat-card">
          <div class="label">目的地</div>
          <div class="value">${APP.escapeHtml(dest.name)}</div>
          <div class="sub">${APP.escapeHtml(dest.country)} · ${APP.escapeHtml(dest.region)}</div>
        </div>
        <div class="stat-card">
          <div class="label">行程（含去返程）</div>
          <div class="value">${plan.days} 天</div>
          <div class="sub">Day1 去程 ${plan.startDate} · Day${plan.days} 返程 ${travel.returnDate}</div>
        </div>
        <div class="stat-card">
          <div class="label">花费 / 预算</div>
          <div class="value" style="color:${overspend ? '#dc2626' : '#047857'};">${fmtMoney(plan.runningTotal)}</div>
          <div class="sub">预算 ${fmtMoney(plan.totalBudget)} · ${visa.label || '—'}</div>
        </div>
      </div>
    `;

    // 去程 + 返程
    const renderLeg = (leg, titleEmoji, titleText, subTitle) => `
      <div class="travel-to">
        <h3>${titleEmoji} ${titleText} <span class="day-meta" style="font-weight:normal;">· ${APP.escapeHtml(subTitle)}</span></h3>
        <div class="transport-cards">
          ${leg.options.map(o => `
            <div class="transport-card ${o.recommended ? 'recommended' : ''}">
              <div class="head">
                <span>${o.title}</span>
                ${o.recommended ? '<span class="badge">推荐</span>' : `<span class="day-meta">${o.eta}</span>`}
              </div>
              <p>${APP.escapeHtml(o.desc)}</p>
              <div class="booking-row">
                ${o.bookings.map(b => `<a href="${b.url}" target="_blank" rel="noopener">${APP.escapeHtml(b.label)}</a>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    html += renderLeg(
      travel.outbound,
      '🛫',
      `去程：<strong>${APP.escapeHtml(originShort)}</strong> → <strong>${APP.escapeHtml(dest.name)}</strong>`,
      `出发日 ${plan.startDate}`
    );
    html += renderLeg(
      travel.inbound,
      '🛬',
      `返程：<strong>${APP.escapeHtml(dest.name)}</strong> → <strong>${APP.escapeHtml(originShort)}</strong>`,
      `返程日 ${travel.returnDate}`
    );

    // 双栏：地图 + 当日列表
    const dayOptions = plan.itinerary.map(d =>
      `<option value="${d.day}">Day ${d.day}（${d.date}）· ${d.totalKm.toFixed(1)} km</option>`
    ).join('');

    html += `
      <div class="plan-layout">
        <div class="map-block">
          <div class="toolbar">
            <strong style="font-size:14px;">🗺️ 行程地图</strong>
            <select id="mapDaySel">
              <option value="overview">📌 全程总览</option>
              ${dayOptions}
            </select>
            <span class="day-meta" id="mapDayDist"></span>
          </div>
          <div id="leafletMap"></div>
          <div class="map-legend">
            <span><span class="dot" style="background:#047857;"></span>出发地</span>
            <span><span class="dot" style="background:#2d6cdf;"></span>目的地</span>
            <span><span class="dot" style="background:#ff6f3c;"></span>景点（按时间编号）</span>
            <span><span class="dot" style="background:#b45309;"></span>餐厅</span>
            <span><span class="dot" style="background:#4f46e5;"></span>酒店</span>
          </div>
        </div>
        <div class="days-wrap">
          ${plan.itinerary.map(day => renderDay(day, dest)).join('')}
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
            <button class="btn btn-outline" onclick="window.__exportPlan()">⬇️ 导出 JSON</button>
            <button class="btn btn-outline" onclick="window.__savePlan()">💾 保存到本地</button>
            <button class="btn btn-ghost" onclick="window.print()">🖨️ 打印行程</button>
          </div>
        </div>
      </div>
    `;

    $result.innerHTML = html;

    // 初始化地图
    initLeaflet(plan, travel);

    // 绑定列表点击 → 高亮 + 抽屉
    document.querySelectorAll('.item-row').forEach(el => {
      el.addEventListener('click', () => {
        const dayNum = parseInt(el.dataset.day, 10);
        const itemId = el.dataset.itemId;
        focusItem(dayNum, itemId);
      });
    });

    // 切换地图视图
    document.getElementById('mapDaySel').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'overview') drawOverview(plan, travel);
      else drawDay(plan, parseInt(v, 10));
    });

    // 默认显示总览
    drawOverview(plan, travel);

    window.__exportPlan = () => {
      const blob = new Blob([JSON.stringify({ origin, plan, travel }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${dest.name}-${plan.days}日行程.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };
    window.__savePlan = () => {
      localStorage.setItem(APP.STORAGE_KEYS.TRIP_PLAN, JSON.stringify({ origin, plan }));
      APP.toast('已保存到本地');
    };
  }

  function renderDay(day, dest) {
    const items = day.items.map((it, idx) => {
      const numBadge = (it.type === 'sight') ? `<span class="marker-num">${attrIndex(day, it)}</span>` : '';
      return `
        <div class="item-row" data-day="${day.day}" data-item-id="${it.id}">
          <div class="time">${APP.escapeHtml(it.time)}</div>
          <div style="display:flex;gap:12px;align-items:center;">
            <div class="icon-wrap ${it.type}">${it.icon}</div>
            <div>
              <div class="name">${numBadge}${APP.escapeHtml(it.name)}</div>
              <div class="meta">${APP.escapeHtml(it.label)} · ${APP.escapeHtml(it.meta || '')}</div>
            </div>
          </div>
          <div class="cost">${it.cost ? fmtMoney(it.cost) : '免费'}</div>
        </div>
      `;
    }).join('');
    const tag = day.isFirst && day.isLast ? '🛫🛬 一日往返'
              : day.isFirst ? '🛫 抵达日'
              : day.isLast ? '🛬 返程日'
              : '';
    return `
      <div class="day-block-plan">
        <h3>
          <span class="day-num">Day ${day.day}</span>
          <span>${APP.escapeHtml(day.date || '')}</span>
          ${tag ? `<span class="day-num" style="background:#fff3ec;color:var(--color-primary);">${tag}</span>` : ''}
          <span class="day-meta">· 当日预计花费 ${fmtMoney(day.total)} · 当日总路程 ${day.totalKm.toFixed(1)} km（已最优化）</span>
        </h3>
        <div>${items}</div>
        <div class="day-actions">
          <button class="btn btn-outline" onclick="document.getElementById('mapDaySel').value=${day.day};document.getElementById('mapDaySel').dispatchEvent(new Event('change'));">🗺️ 在地图查看本日路线</button>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="${gmapsDirsUrl(day, currentPlan)}">↗ 用 Google Maps 导航</a>
        </div>
      </div>
    `;
  }
  // 该景点在当日是第几个景点（用于地图编号一致）
  function attrIndex(day, item) {
    let n = 0;
    for (const it of day.items) {
      if (it.type === 'sight') n++;
      if (it === item) return n;
    }
    return n;
  }
  function gmapsDirsUrl(day, plan) {
    const pts = [plan.hotel.coord, ...day.items.filter(i => i.coord && (i.type === 'sight' || i.type === 'food')).map(i => i.coord), plan.hotel.coord];
    const origin = `${pts[0].lat},${pts[0].lng}`;
    const destination = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`;
    const wp = pts.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit${wp ? '&waypoints=' + encodeURIComponent(wp) : ''}`;
  }

  // ============= Leaflet 地图 =============
  function initLeaflet(plan, travel) {
    const dest = plan.dest;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    leafletMap = L.map('leafletMap', { zoomControl: true, scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(leafletMap);
    leafletMap.setView([dest.coord.lat, dest.coord.lng], 12);
  }

  function clearMarkers() {
    mapMarkers.forEach(m => leafletMap.removeLayer(m.marker));
    mapMarkers = [];
    if (routeLayer) { leafletMap.removeLayer(routeLayer); routeLayer = null; }
  }
  function makeIcon(text, cls = '') {
    return L.divIcon({
      className: '',
      html: `<div class="num-marker ${cls}">${text}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function drawOverview(plan, travel) {
    clearMarkers();
    const dest = plan.dest;
    const oMarker = L.marker([origin.lat, origin.lng], { icon: makeIcon('🚩', 'origin') }).addTo(leafletMap);
    oMarker.bindPopup(`<strong>出发地</strong><br>${APP.escapeHtml(origin.name)}`);
    const dMarker = L.marker([dest.coord.lat, dest.coord.lng], { icon: makeIcon('🏁', 'dest') }).addTo(leafletMap);
    dMarker.bindPopup(`<strong>目的地</strong><br>${APP.escapeHtml(dest.name)} · ${APP.escapeHtml(dest.country)}`);
    mapMarkers.push({ id: 'origin', marker: oMarker });
    mapMarkers.push({ id: 'dest', marker: dMarker });

    // 去程：实线蓝色
    const outboundLine = L.polyline(
      [[origin.lat, origin.lng], [dest.coord.lat, dest.coord.lng]],
      { color: '#2d6cdf', weight: 3, opacity: .85 }
    ).addTo(leafletMap);
    // 返程：虚线橙色，稍微偏移避免完全重叠
    const inboundLine = L.polyline(
      [[dest.coord.lat, dest.coord.lng], [origin.lat, origin.lng]],
      { color: '#ff6f3c', weight: 3, dashArray: '8 8', opacity: .85 }
    ).addTo(leafletMap);
    // 用 FeatureGroup 方便统一管理 + fitBounds
    routeLayer = L.featureGroup([outboundLine, inboundLine]).addTo(leafletMap);

    leafletMap.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    const distKm = Math.round((travel.outbound && travel.outbound.dist) || 0);
    document.getElementById('mapDayDist').textContent =
      `· 单程 ${distKm} km · 去程(蓝)+返程(橙)`;
  }

  function drawDay(plan, dayNum) {
    clearMarkers();
    const day = plan.itinerary.find(d => d.day === dayNum);
    if (!day) return;
    const hotel = plan.hotel;

    // 酒店
    const hMarker = L.marker([hotel.coord.lat, hotel.coord.lng], { icon: makeIcon('🛏', 'hotel') }).addTo(leafletMap);
    hMarker.bindPopup(`<strong>酒店</strong><br>${APP.escapeHtml(hotel.name)}`);
    mapMarkers.push({ id: `${day.day}-hotel`, marker: hMarker, dayItem: day.items.find(i => i.type === 'hotel') });

    // 景点（按顺序编号）
    let sightIdx = 0;
    day.items.forEach(it => {
      if (!it.coord) return;
      let mk;
      if (it.type === 'sight') {
        sightIdx++;
        mk = L.marker([it.coord.lat, it.coord.lng], { icon: makeIcon(String(sightIdx)) }).addTo(leafletMap);
        mk.bindPopup(`<strong>${APP.escapeHtml(it.name)}</strong><br>${APP.escapeHtml(it.label)} · ${APP.escapeHtml(it.time)}`);
      } else if (it.type === 'food') {
        mk = L.marker([it.coord.lat, it.coord.lng], { icon: makeIcon('🍴', 'food') }).addTo(leafletMap);
        mk.bindPopup(`<strong>${APP.escapeHtml(it.name)}</strong><br>${APP.escapeHtml(it.label)}`);
      } else if (it.type === 'hotel') {
        return;
      }
      if (mk) {
        const itemId = it.id;
        mk.on('click', () => focusItem(day.day, itemId));
        mapMarkers.push({ id: `${day.day}-${itemId}`, marker: mk, dayItem: it });
      }
    });

    // 路线（酒店 → 景点（按顺序）→ 酒店）
    const seq = [hotel.coord];
    day.items.filter(i => i.type === 'sight' && i.coord).forEach(s => seq.push(s.coord));
    seq.push(hotel.coord);
    routeLayer = L.polyline(seq.map(p => [p.lat, p.lng]), {
      color: '#ff6f3c', weight: 4, opacity: .9,
    }).addTo(leafletMap);

    leafletMap.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    document.getElementById('mapDayDist').textContent = `· 当日路程 ${day.totalKm.toFixed(1)} km · 已最优化`;
  }

  function focusItem(dayNum, itemId) {
    // 切换地图到对应日
    const sel = document.getElementById('mapDaySel');
    if (sel.value !== String(dayNum)) {
      sel.value = String(dayNum);
      drawDay(currentPlan, dayNum);
    }
    // 高亮对应 marker
    mapMarkers.forEach(m => {
      const div = m.marker.getElement();
      if (!div) return;
      const inner = div.querySelector('.num-marker');
      if (inner) inner.classList.remove('active');
    });
    const target = mapMarkers.find(m => m.id === `${dayNum}-${itemId}` || (itemId === 'hotel' && m.id === `${dayNum}-hotel`));
    if (target) {
      const inner = target.marker.getElement() && target.marker.getElement().querySelector('.num-marker');
      if (inner) inner.classList.add('active');
      leafletMap.setView(target.marker.getLatLng(), 15, { animate: true });
      target.marker.openPopup();
    }
    // 高亮列表行
    document.querySelectorAll('.item-row').forEach(el => el.classList.remove('active'));
    const row = document.querySelector(`.item-row[data-day="${dayNum}"][data-item-id="${itemId}"]`);
    if (row) row.classList.add('active');

    // 打开抽屉
    const day = currentPlan.itinerary.find(d => d.day === dayNum);
    const item = day && day.items.find(i => i.id === itemId);
    if (item) openDrawer(item);
  }

  // ============= 详情抽屉 =============
  function openDrawer(item) {
    const dest = currentPlan.dest;
    const desc = genDesc(item.ref || item, item.type, dest);
    const links = bookingLinks(item.ref || item, item.type, dest);
    const meta = [];
    if (item.label) meta.push(item.label);
    if (item.time && item.time !== '全天') meta.push(item.time);
    if (item.cost) meta.push(fmtMoney(item.cost));
    if (item.ref && item.ref.tag) meta.push(item.ref.tag);
    if (item.ref && item.ref.level) meta.push(item.ref.level);
    if (item.ref && item.ref.type) meta.push(item.ref.type);

    $drawerTitle.textContent = item.name;
    $drawerBody.innerHTML = `
      <div class="meta-line">
        ${meta.map(m => `<span class="pill">${APP.escapeHtml(m)}</span>`).join('')}
      </div>
      <p>${APP.escapeHtml(desc)}</p>
      ${item.ref && item.ref.info ? `<p style="color:var(--color-muted);font-size:13px;">${(item.ref.info || []).map(s => APP.escapeHtml(s)).join('<br>')}</p>` : ''}
      <div class="booking-section">
        <h4>${item.type === 'sight' ? '🎟️ 购票与查看' : item.type === 'food' ? '🍽️ 订位与查看' : item.type === 'hotel' ? '🏨 预订房间' : '🚇 交通查询'}</h4>
        <div class="booking-grid">
          ${links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${APP.escapeHtml(l.label)}</a>`).join('')}
        </div>
        ${item.coord ? `<div style="margin-top:10px;"><a class="btn btn-outline" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=${currentPlan.hotel.coord.lat},${currentPlan.hotel.coord.lng}&destination=${item.coord.lat},${item.coord.lng}">🚇 从酒店出发的导航</a></div>` : ''}
      </div>
    `;
    $drawer.classList.add('show');
    $drawerMask.classList.add('show');
  }
  window.closeDrawer = function () {
    $drawer.classList.remove('show');
    $drawerMask.classList.remove('show');
  };

  // ============= 主入口 =============
  window.generatePlan = async function (e) {
    e.preventDefault();
    if (!origin) {
      // 尝试自动解析输入框
      if ($originInput.value.trim()) {
        await window.resolveOriginInput();
      }
    }
    if (!origin) {
      setOriginStatus('⚠️ 请先设置出发地（可点击"使用我的当前位置"或在输入框中填写后点击"解析输入位置"）。', 'err');
      $originInput.focus();
      return;
    }
    const destId = $dest.value;
    const days = Math.max(1, Math.min(14, parseInt($days.value, 10)));
    const budget = Math.max(500, parseInt($budget.value, 10));
    const start = $start.value;
    const plan = buildPlan(destId, days, budget, start);
    if (!plan) return;
    // 返程日 = 行程最后一天（去程占用第 1 天，返程占用第 days 天）
    const returnDate = dateOffset(start, Math.max(0, days - 1));
    const outbound = buildTravelOptions(origin, plan.dest, 'outbound', start);
    const inbound = buildTravelOptions(origin, plan.dest, 'return', returnDate);
    renderPlan(plan, { outbound, inbound, returnDate });
    document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.resetPlan = function () {
    $form.reset();
    visaFilter = 'any';
    $visaPills.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    $visaPills.querySelector('[data-visa="any"]').classList.add('active');
    fillDest();
    $days.value = 3; $budget.value = 5000;
    const t = new Date(); t.setDate(t.getDate() + 14);
    $start.value = t.toISOString().slice(0, 10);
    $result.innerHTML = `
      <div class="placeholder-result">
        <div class="emoji">🧭</div>
        <h3 style="margin:6px 0;">先告诉我你的出发地，再生成行程</h3>
        <p>系统会先帮你规划去程交通（飞机/高铁/自驾），再生成每天最短路径的城内行程。</p>
      </div>`;
  };
})();
