import { initialSpots } from '../data/spots.js';

// ==========================================
// 状態管理
// ==========================================
const STORAGE_KEYS = {
  KEPT: 'futari_plan_kept_spots_v1',
  CUSTOM: 'futari_plan_custom_spots_v1'
};

let allSpots = [];
let filteredSpots = [];
let currentIndex = 0;
let keptSpotIds = new Set();
let customSpots = [];

// フィルター状態
let currentPref = 'all'; // 'all' | '福岡県' | '佐賀県'
let currentTag = 'all';  // 'all' | 'ドライブ' | 'まったり' etc.
let searchKeyword = '';

// ドラッグ / スワイプ状態
let startX = 0;
let currentTranslate = 0;
let isDragging = false;

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  setupSpots();
  setupEventListeners();
  renderCards();
  updateKeptBadge();
  lucide.createIcons();
});

// ストレージからデータ復元
function loadStoredData() {
  try {
    const savedKept = localStorage.getItem(STORAGE_KEYS.KEPT);
    if (savedKept) {
      keptSpotIds = new Set(JSON.parse(savedKept));
    }
    const savedCustom = localStorage.getItem(STORAGE_KEYS.CUSTOM);
    if (savedCustom) {
      customSpots = JSON.parse(savedCustom);
    }
  } catch (e) {
    console.error('Failed to parse localStorage data', e);
  }
}

// スポットデータの統合
function setupSpots() {
  // カスタム追加分を先頭にして、マスターデータと合算
  allSpots = [...customSpots, ...initialSpots];
  applyFilters();
}

// フィルター適用
function applyFilters() {
  filteredSpots = allSpots.filter(spot => {
    // 都道府県
    if (currentPref !== 'all' && spot.pref !== currentPref) {
      return false;
    }
    // タグ・気分
    if (currentTag !== 'all') {
      if (currentTag === '雨天OK') {
        if (!spot.rainOk) return false;
      } else if (!spot.tags.includes(currentTag)) {
        return false;
      }
    }
    // キーワード検索（タイトル、スポット名、エリア、やること）
    if (searchKeyword.trim() !== '') {
      const q = searchKeyword.toLowerCase();
      const match = spot.title.toLowerCase().includes(q) ||
                    spot.spotName.toLowerCase().includes(q) ||
                    spot.area.toLowerCase().includes(q) ||
                    spot.action.toLowerCase().includes(q) ||
                    spot.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  currentIndex = 0;
  renderCards();
  updateCounter();
}

// ==========================================
// カルーセルレンダリング
// ==========================================
const stage = document.getElementById('carousel-stage');

function renderCards() {
  stage.innerHTML = '';

  if (filteredSpots.length === 0) {
    stage.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-stone-500 bg-white/70 rounded-3xl border border-stone-200 shadow-sm max-w-sm">
        <i data-lucide="compass" class="w-12 h-12 text-stone-400 mb-3"></i>
        <h3 class="font-bold text-stone-700 text-lg mb-1">該当するデートプランがありません</h3>
        <p class="text-xs text-stone-500 mb-4">条件を変えて探すか、オリジナルのプランを追加してみてください。</p>
        <button id="btn-reset-filters" class="px-4 py-2 bg-stone-800 text-white text-xs font-bold rounded-full hover:bg-stone-700 transition">
          フィルターをリセット
        </button>
      </div>
    `;
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      currentPref = 'all';
      currentTag = 'all';
      searchKeyword = '';
      updateFilterButtonsUI();
      applyFilters();
    });
    lucide.createIcons();
    updateCounter();
    return;
  }

  // 前後および現在のカードを作成
  // パフォーマンスのため、現在インデックス付近のカードのみDOMに描画
  filteredSpots.forEach((spot, idx) => {
    // 遠すぎるカードは描画しない（現在インデックス±2）
    const diff = idx - currentIndex;
    if (Math.abs(diff) > 2 && !(currentIndex === 0 && idx === filteredSpots.length - 1) && !(currentIndex === filteredSpots.length - 1 && idx === 0)) {
      return;
    }

    const card = createCardElement(spot, idx);
    stage.appendChild(card);
  });

  updateCardPositions();
  updateCounter();
  lucide.createIcons();
}

// カードDOM要素の生成
function createCardElement(spot, index) {
  const card = document.createElement('div');
  card.className = 'card-item';
  card.dataset.index = index;
  card.dataset.id = spot.id;

  const isKept = keptSpotIds.has(spot.id);
  const prefClass = spot.pref === '福岡県' ? 'fukuoka' : 'saga';

  // タグチップHTML
  const tagChips = spot.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('');

  // 雨天OKバッジ
  const rainBadge = spot.rainOk 
    ? `<span class="card-badge-rain"><i data-lucide="umbrella" class="w-3 h-3"></i>雨OK</span>` 
    : '';

  card.innerHTML = `
    <div class="card-image-wrap">
      <img src="${spot.imageUrl}" alt="${spot.title}" class="card-image" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'">
      <div class="card-badge-pref ${prefClass}">
        <i data-lucide="map-pin" class="w-3 h-3"></i>
        <span>${spot.pref} · ${spot.area}</span>
      </div>
      ${rainBadge}
    </div>

    <div class="card-body">
      <div>
        <h2 class="card-title">${spot.title}</h2>
        <div class="card-spot-name">
          <i data-lucide="navigation" class="w-3.5 h-3.5 flex-shrink-0"></i>
          <span>${spot.spotName}</span>
        </div>

        <div class="card-action">
          <p>${spot.action}</p>
        </div>

        <div class="card-meta-chips">
          <span class="meta-chip">
            <i data-lucide="wallet" class="w-3 h-3 text-stone-400"></i>
            ${spot.budget}
          </span>
          <span class="meta-chip">
            <i data-lucide="clock" class="w-3 h-3 text-stone-400"></i>
            ${spot.time}
          </span>
          <span class="meta-chip">
            <i data-lucide="sun" class="w-3 h-3 text-amber-500"></i>
            ${spot.recommendedTime}
          </span>
        </div>

        <div class="flex flex-wrap gap-1.5 mb-2">
          ${tagChips}
        </div>
      </div>

      <div class="card-actions-bar">
        <button class="btn-keep ${isKept ? 'kept' : ''}" data-id="${spot.id}">
          <i data-lucide="heart" class="w-4 h-4 ${isKept ? 'fill-current' : ''}"></i>
          <span>${isKept ? 'キープ中' : 'キープする'}</span>
        </button>

        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapQuery)}" target="_blank" rel="noopener noreferrer" class="btn-icon-circle" title="Googleマップで開く">
          <i data-lucide="map" class="w-4 h-4"></i>
        </a>

        <button class="btn-icon-circle btn-share-line" data-id="${spot.id}" title="LINEで相談する文面をコピー">
          <i data-lucide="share-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;

  // イベント登録
  const keepBtn = card.querySelector('.btn-keep');
  keepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleKeep(spot.id, keepBtn);
  });

  const shareBtn = card.querySelector('.btn-share-line');
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyShareText(spot);
  });

  // カードクリックでアクティブにする
  card.addEventListener('click', () => {
    if (index === currentIndex + 1 || (currentIndex === filteredSpots.length - 1 && index === 0)) {
      nextCard();
    } else if (index === currentIndex - 1 || (currentIndex === 0 && index === filteredSpots.length - 1)) {
      prevCard();
    }
  });

  return card;
}

// カードの3D配置更新
function updateCardPositions() {
  const cards = stage.querySelectorAll('.card-item');
  const total = filteredSpots.length;

  cards.forEach(card => {
    const idx = parseInt(card.dataset.index, 10);
    card.classList.remove('active', 'prev', 'next', 'hidden-left', 'hidden-right');

    if (idx === currentIndex) {
      card.classList.add('active');
    } else if (idx === (currentIndex - 1 + total) % total) {
      card.classList.add('prev');
    } else if (idx === (currentIndex + 1) % total) {
      card.classList.add('next');
    } else if (idx < currentIndex) {
      card.classList.add('hidden-left');
    } else {
      card.classList.add('hidden-right');
    }
  });
}

// カウンター更新
function updateCounter() {
  const counterEl = document.getElementById('card-counter');
  if (!counterEl) return;
  if (filteredSpots.length === 0) {
    counterEl.textContent = '0 / 0';
  } else {
    counterEl.textContent = `${currentIndex + 1} / ${filteredSpots.length}`;
  }
}

// カード操作（次へ / 前へ）
function nextCard() {
  if (filteredSpots.length <= 1) return;
  currentIndex = (currentIndex + 1) % filteredSpots.length;
  renderCards();
}

function prevCard() {
  if (filteredSpots.length <= 1) return;
  currentIndex = (currentIndex - 1 + filteredSpots.length) % filteredSpots.length;
  renderCards();
}

// ランダムガチャ提案
function randomSpot() {
  if (filteredSpots.length <= 1) return;
  
  const gachaBtn = document.getElementById('btn-gacha');
  if (gachaBtn) {
    gachaBtn.classList.add('spinning');
    setTimeout(() => gachaBtn.classList.remove('spinning'), 600);
  }

  // 現在と異なるランダムなインデックスを選択
  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * filteredSpots.length);
  } while (nextIdx === currentIndex && filteredSpots.length > 1);

  currentIndex = nextIdx;
  renderCards();
  showToast('🎲 おすすめのデートプランを引きました！');
}

// ==========================================
// キープ（お気に入り）管理
// ==========================================
function toggleKeep(spotId, btnEl) {
  const icon = btnEl.querySelector('i');
  const label = btnEl.querySelector('span');

  if (keptSpotIds.has(spotId)) {
    keptSpotIds.delete(spotId);
    btnEl.classList.remove('kept');
    label.textContent = 'キープする';
    if (icon) icon.classList.remove('fill-current');
    showToast('キープを解除しました');
  } else {
    keptSpotIds.add(spotId);
    btnEl.classList.add('kept');
    label.textContent = 'キープ中';
    if (icon) {
      icon.classList.add('fill-current');
      btnEl.classList.add('heart-pulse');
      setTimeout(() => btnEl.classList.remove('heart-pulse'), 500);
    }
    showToast('❤️ 気になるプランにキープしました！');
  }

  // 保存
  localStorage.setItem(STORAGE_KEYS.KEPT, JSON.stringify(Array.from(keptSpotIds)));
  updateKeptBadge();
}

function updateKeptBadge() {
  const badge = document.getElementById('kept-badge');
  if (!badge) return;
  const count = keptSpotIds.size;
  badge.textContent = count;
  if (count > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ==========================================
// LINE相談用テキスト生成
// ==========================================
function copyShareText(spot) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapQuery)}`;
  const text = `ねえねえ、今度ここ行ってみない？✨

【${spot.title}】
📍場所: ${spot.spotName} (${spot.pref} ${spot.area})
💡楽しみ方: ${spot.action}
💰目安: ${spot.budget} / ${spot.time}

🗺️ Googleマップで見る:
${mapUrl}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 LINE相談用の文面をコピーしました！');
  }).catch(err => {
    console.error('Failed to copy', err);
    // フォールバック
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('📋 LINE相談用の文面をコピーしました！');
  });
}

// ==========================================
// モーダル管理（キープ一覧 / カスタム追加）
// ==========================================
function openKeptModal() {
  const modal = document.getElementById('modal-kept');
  const container = document.getElementById('kept-list-container');
  if (!modal || !container) return;

  container.innerHTML = '';

  const keptList = allSpots.filter(s => keptSpotIds.has(s.id));

  if (keptList.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-stone-400">
        <i data-lucide="heart-off" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
        <p class="font-bold text-stone-600">まだキープしたプランがありません</p>
        <p class="text-xs mt-1">カード右下の「キープする」ボタンを押すと保存されます。</p>
      </div>
    `;
  } else {
    keptList.forEach(spot => {
      const item = document.createElement('div');
      item.className = 'flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200 hover:border-orange-300 transition';
      item.innerHTML = `
        <img src="${spot.imageUrl}" alt="${spot.title}" class="w-16 h-16 rounded-xl object-cover flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80'">
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-1 text-[11px] font-bold text-orange-600 mb-0.5">
            <span>${spot.pref} · ${spot.area}</span>
          </div>
          <h4 class="font-bold text-xs text-stone-800 truncate">${spot.title}</h4>
          <p class="text-[11px] text-stone-500 truncate">${spot.spotName}</p>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapQuery)}" target="_blank" rel="noopener noreferrer" class="p-2 text-stone-500 hover:text-orange-600 bg-white rounded-full border border-stone-200" title="地図">
            <i data-lucide="map" class="w-3.5 h-3.5"></i>
          </a>
          <button class="p-2 text-stone-500 hover:text-green-600 bg-white rounded-full border border-stone-200 btn-modal-share" data-id="${spot.id}" title="LINE共有コピー">
            <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
          </button>
          <button class="p-2 text-stone-400 hover:text-rose-600 bg-white rounded-full border border-stone-200 btn-modal-remove" data-id="${spot.id}" title="削除">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      item.querySelector('.btn-modal-share').addEventListener('click', () => copyShareText(spot));
      item.querySelector('.btn-modal-remove').addEventListener('click', () => {
        keptSpotIds.delete(spot.id);
        localStorage.setItem(STORAGE_KEYS.KEPT, JSON.stringify(Array.from(keptSpotIds)));
        updateKeptBadge();
        renderCards();
        openKeptModal(); // 再描画
      });

      container.appendChild(item);
    });
  }

  modal.classList.add('open');
  lucide.createIcons();
}

function closeKeptModal() {
  const modal = document.getElementById('modal-kept');
  if (modal) modal.classList.remove('open');
}

function openAddModal() {
  const modal = document.getElementById('modal-add');
  if (modal) modal.classList.add('open');
}

function closeAddModal() {
  const modal = document.getElementById('modal-add');
  if (modal) modal.classList.remove('open');
}

// カスタムプラン追加フォーム処理
function handleAddCustomPlan(e) {
  e.preventDefault();
  const form = e.target;

  const pref = form.pref.value;
  const area = form.area.value.trim() || 'その他';
  const title = form.title.value.trim();
  const spotName = form.spotName.value.trim();
  const action = form.action.value.trim();
  const budget = form.budget.value.trim() || '¥1,000〜¥3,000';
  const time = form.time.value.trim() || '2〜3時間';
  const rainOk = form.rainOk.checked;
  const imageUrl = form.imageUrl.value.trim() || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80';
  
  // タグ
  const selectedTags = Array.from(form.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);
  if (selectedTags.length === 0) selectedTags.push('まったり');

  const newSpot = {
    id: `custom-${Date.now()}`,
    pref,
    area,
    title,
    spotName,
    action,
    highlight: 'オリジナルの追加デートプラン',
    tags: selectedTags,
    budget,
    time,
    recommendedTime: '終日',
    rainOk,
    mapQuery: `${spotName} ${area}`,
    imageUrl
  };

  customSpots.unshift(newSpot);
  localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(customSpots));

  form.reset();
  closeAddModal();
  setupSpots();
  showToast('🎉 新しいデートプランを登録しました！');
}

// ==========================================
// イベントリスナー設定
// ==========================================
function setupEventListeners() {
  // ナビゲーションボタン
  document.getElementById('btn-next')?.addEventListener('click', nextCard);
  document.getElementById('btn-prev')?.addEventListener('click', prevCard);
  document.getElementById('btn-gacha')?.addEventListener('click', randomSpot);

  // キーボード操作
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextCard();
    if (e.key === 'ArrowLeft') prevCard();
  });

  // スワイプ / タッチ・ドラッグジェスチャー
  setupGestures();

  // フィルターボタン（エリア）
  document.querySelectorAll('.filter-pref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pref-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPref = btn.dataset.pref;
      applyFilters();
    });
  });

  // フィルターピル（タグ）
  document.querySelectorAll('.filter-tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (currentTag === pill.dataset.tag) {
        currentTag = 'all';
        pill.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-tag-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentTag = pill.dataset.tag;
      }
      applyFilters();
    });
  });

  // 検索入力
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', (e) => {
    searchKeyword = e.target.value;
    applyFilters();
  });

  // モーダル開閉
  document.getElementById('btn-open-kept')?.addEventListener('click', openKeptModal);
  document.getElementById('btn-close-kept')?.addEventListener('click', closeKeptModal);
  document.getElementById('modal-kept')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-kept') closeKeptModal();
  });

  document.getElementById('btn-open-add')?.addEventListener('click', openAddModal);
  document.getElementById('btn-close-add')?.addEventListener('click', closeAddModal);
  document.getElementById('modal-add')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-add') closeAddModal();
  });

  // カスタムフォーム送信
  document.getElementById('form-add-spot')?.addEventListener('submit', handleAddCustomPlan);
}

// フィルターボタンのUI同期
function updateFilterButtonsUI() {
  document.querySelectorAll('.filter-pref-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pref === currentPref);
  });
  document.querySelectorAll('.filter-tag-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.tag === currentTag);
  });
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = searchKeyword;
}

// タッチスワイプ＆マウスドラッグ
function setupGestures() {
  stage.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    const endX = e.changedTouches[0].clientX;
    handleGestureEnd(endX);
  }, { passive: true });

  stage.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isDragging = true;
  });

  stage.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    handleGestureEnd(e.clientX);
  });
}

function handleGestureEnd(endX) {
  isDragging = false;
  const diffX = endX - startX;
  if (diffX > 50) {
    prevCard();
  } else if (diffX < -50) {
    nextCard();
  }
}

// トースト通知表示
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast-msg');
  if (!toast) return;

  toast.innerHTML = `<span>${message}</span>`;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}
