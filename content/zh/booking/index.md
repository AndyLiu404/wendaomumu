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
  <div class="city-card-icon">🗼</div>
  <h3 class="city-name">东京</h3>
  <p class="city-desc">上野・浅草・皇居・日本桥</p>
  <div class="coming-soon-badge">即将上线，敬请期待</div>
</div>

<div class="city-card">
  <div class="city-card-icon">🌉</div>
  <h3 class="city-name">上海</h3>
  <p class="city-desc">外滩・法租界・老城厢・衡复</p>
  <div class="coming-soon-badge">即将上线，敬请期待</div>
</div>

<div class="city-card">
  <div class="city-card-icon">🌁</div>
  <h3 class="city-name">旧金山</h3>
  <p class="city-desc">唐人街・渔人码头・诺布山</p>
  <div class="coming-soon-badge">即将上线，敬请期待</div>
</div>

</div>
</div>

<style>
.booking-page { padding: 8px 0 40px; }
.booking-intro {
  font-size: 1.7rem;
  color: var(--text-secondary);
  margin-bottom: 32px;
  line-height: 1.7;
}
.city-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.city-card {
  background: var(--card-background);
  border-radius: 14px;
  padding: 24px 28px;
  box-shadow: var(--shadow-l1);
  display: flex;
  align-items: center;
  gap: 20px;
}
.city-card-icon { font-size: 2.8rem; flex-shrink: 0; }
.city-name {
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}
.city-desc {
  font-size: 1.4rem;
  color: var(--text-secondary);
  margin: 0;
}
.coming-soon-badge {
  margin-left: auto;
  font-size: 1.3rem;
  color: var(--accent-color);
  background: rgba(224, 122, 58, 0.1);
  border-radius: 20px;
  padding: 6px 14px;
  white-space: nowrap;
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .city-card { flex-wrap: wrap; }
  .coming-soon-badge { margin-left: 0; }
}
</style>
