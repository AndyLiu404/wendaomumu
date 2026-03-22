---
title: "线下 CityWalk 预约"
description: "跟着文道木木，用脚步丈量城市"
toc: false
comments: false
---

<div class="booking-page">

<p class="booking-intro">文道木木线下城市漫步，即将开启。选择你感兴趣的城市，第一时间获得上线通知。</p>

<div class="city-cards">

<div class="city-card">
  <div class="city-cover" style="background-image:url('https://r2.wendaomumu.com/tours/tokyo-imperial/cover.jpg')">
    <div class="city-cover-overlay"></div>
    <span class="city-badge">即将上线</span>
    <div class="city-cover-content">
      <span class="city-icon">🗼</span>
      <div class="city-text">
        <h3 class="city-name">东京</h3>
        <p class="city-desc">上野・浅草・皇居・日本桥</p>
      </div>
    </div>
  </div>
</div>

<div class="city-card">
  <div class="city-cover" style="background-image:url('https://r2.wendaomumu.com/booking/shanghai-cover.jpg')">
    <div class="city-cover-overlay"></div>
    <span class="city-badge">即将上线</span>
    <div class="city-cover-content">
      <span class="city-icon">🌉</span>
      <div class="city-text">
        <h3 class="city-name">上海</h3>
        <p class="city-desc">外滩・法租界・老城厢・衡复</p>
      </div>
    </div>
  </div>
</div>

<div class="city-card">
  <div class="city-cover" style="background-image:url('https://r2.wendaomumu.com/booking/sf-cover.jpg')">
    <div class="city-cover-overlay"></div>
    <span class="city-badge">即将上线</span>
    <div class="city-cover-content">
      <span class="city-icon">🌁</span>
      <div class="city-text">
        <h3 class="city-name">旧金山</h3>
        <p class="city-desc">唐人街・渔人码头・诺布山</p>
      </div>
    </div>
  </div>
</div>

</div>
</div>

<style>
/* ── Hide reading time meta — not relevant on a landing page ── */
.article-meta { display: none; }

/* ── Page layout ── */
.booking-page { padding: 8px 0 48px; }
.booking-intro {
  font-size: 1.7rem;
  color: var(--text-secondary);
  margin-bottom: 28px;
  line-height: 1.7;
}

/* ── Cards ── */
.city-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.city-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1),
    box-shadow 0.28s ease;
  cursor: default;
}

.city-card:hover {
  transform: translateY(-5px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.09),
    0 20px 48px rgba(0, 0, 0, 0.08);
}

/* ── Cover image area ── */
.city-cover {
  position: relative;
  height: 200px;
  background-size: cover;
  background-position: center;
}

/* Directional gradient: transparent top-left → dark bottom */
.city-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    rgba(0, 0, 0, 0.08) 0%,
    rgba(0, 0, 0, 0.30) 50%,
    rgba(0, 0, 0, 0.68) 100%
  );
}

/* ── Frosted glass badge (top-right) ── */
.city-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 20px;
  padding: 4px 12px;
  letter-spacing: 0.02em;
  line-height: 1.6;
}

/* ── Text block (bottom-left) ── */
.city-cover-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 22px;
  display: flex;
  align-items: flex-end;
  gap: 13px;
}

.city-icon {
  font-size: 2.2rem;
  line-height: 1;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.city-text { display: flex; flex-direction: column; }

.city-name {
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 3px;
  letter-spacing: -0.3px;
  line-height: 1.2;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
}

.city-desc {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.82);
  margin: 0;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  line-height: 1.4;
}

/* ── Mobile ── */
@media (max-width: 600px) {
  .city-cover { height: 180px; }
  .city-name { font-size: 2rem; }
}
</style>
