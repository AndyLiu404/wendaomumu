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
    <div class="city-cover-content">
      <span class="city-cover-icon">🗼</span>
      <h3 class="city-cover-name">东京</h3>
      <p class="city-cover-desc">上野・浅草・皇居・日本桥</p>
    </div>
  </div>
  <div class="city-card-body">
    <div class="coming-soon-badge">即将上线，敬请期待</div>
  </div>
</div>

<div class="city-card">
  <div class="city-cover" style="background-image:url('https://r2.wendaomumu.com/booking/shanghai-cover.jpg')">
    <div class="city-cover-overlay"></div>
    <div class="city-cover-content">
      <span class="city-cover-icon">🌉</span>
      <h3 class="city-cover-name">上海</h3>
      <p class="city-cover-desc">外滩・法租界・老城厢・衡复</p>
    </div>
  </div>
  <div class="city-card-body">
    <div class="coming-soon-badge">即将上线，敬请期待</div>
  </div>
</div>

<div class="city-card">
  <div class="city-cover" style="background-image:url('https://r2.wendaomumu.com/booking/sf-cover.jpg')">
    <div class="city-cover-overlay"></div>
    <div class="city-cover-content">
      <span class="city-cover-icon">🌁</span>
      <h3 class="city-cover-name">旧金山</h3>
      <p class="city-cover-desc">唐人街・渔人码头・诺布山</p>
    </div>
  </div>
  <div class="city-card-body">
    <div class="coming-soon-badge">即将上线，敬请期待</div>
  </div>
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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-l1);
}
.city-cover {
  position: relative;
  height: 180px;
  background-size: cover;
  background-position: center;
}
.city-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%);
}
.city-cover-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 18px 22px;
}
.city-cover-icon {
  font-size: 2.2rem;
  line-height: 1;
  margin-bottom: 6px;
}
.city-cover-name {
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
.city-cover-desc {
  font-size: 1.35rem;
  color: rgba(255,255,255,0.85);
  margin: 0;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.city-card-body {
  padding: 14px 22px;
  display: flex;
  align-items: center;
}
.coming-soon-badge {
  font-size: 1.3rem;
  color: var(--accent-color);
  background: rgba(224, 122, 58, 0.1);
  border-radius: 20px;
  padding: 5px 14px;
}
</style>
