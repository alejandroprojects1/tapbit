// Tutorial de 15 segundos: só setas, ícones e números (sem textos longos).
const Tutorial = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ov = $('tutorial');
  const hand = $('tut-hand');
  const arrow = $('tut-arrow');
  const sumEl = $('tut-sum');
  const eq = $('tut-eq');
  const target = $('tut-target');
  const meteor = ov.querySelector('.tut-meteor');
  const beam = $('tut-beam');
  const bar = $('tut-progress');
  const btn = $('btn-tut-go');
  let timers = [], done = null, bits = 0;

  const later = (ms, f) => timers.push(setTimeout(f, ms));
  const tbit = (v) => ov.querySelector(`.tbit[data-v="${v}"]`);

  function setBits(v) {
    bits = v;
    ov.querySelectorAll('.tbit').forEach((b) => {
      const on = !!(v & +b.dataset.v);
      b.classList.toggle('on', on);
      b.querySelector('b').textContent = on ? '1' : '0';
    });
    sumEl.textContent = v;
  }

  function moveHand(v) {
    const stage = ov.querySelector('.tut-stage').getBoundingClientRect();
    const r = tbit(v).getBoundingClientRect();
    hand.style.transform = `translate(${r.left - stage.left + r.width / 2 - 20}px, ${r.top - stage.top + r.height * 0.45}px)`;
  }
  function tap(v, parts) {
    moveHand(v);
    later(450, () => {
      hand.classList.add('press');
      setBits(bits | v);
      Sound.bitOn(v);
      eq.innerHTML = parts;
      later(200, () => hand.classList.remove('press'));
    });
  }

  function demo(t0, value, seq) {
    later(t0, () => {
      setBits(0);
      target.textContent = value;
      meteor.className = 'tut-meteor in';
      arrow.className = 'tut-arrow show';
      eq.innerHTML = '🎯 ' + value;
    });
    let acc = [];
    seq.forEach((v, i) => {
      later(t0 + 1200 + i * 1500, () => {
        arrow.className = 'tut-arrow';
        acc.push(v);
        const last = i === seq.length - 1;
        tap(v, acc.join(' + ') + (last ? ` = <b>${value}</b> ✔` : ''));
      });
    });
    const hitAt = t0 + 1200 + seq.length * 1500;
    later(hitAt, () => {
      beam.className = 'tut-beam fire';
      Sound.laser();
      later(180, () => { meteor.className = 'tut-meteor boom'; Sound.boom(); });
      later(600, () => { beam.className = 'tut-beam'; });
    });
  }

  function open(cb) {
    done = cb;
    timers.forEach(clearTimeout);
    timers = [];
    ov.classList.remove('hidden');
    btn.textContent = 'Pular ▶';
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth;
    bar.style.transition = 'width 15s linear';
    bar.style.width = '100%';
    hand.style.transform = 'translate(40vw, 60vh)';
    setBits(0);
    demo(300, 13, [8, 4, 1]);
    demo(8000, 6, [4, 2]);
    later(13200, () => {
      setBits(13);
      eq.innerHTML = '<span class="bin-eq">01101</span> = 8 + 4 + 1 = <b>13</b>';
      meteor.className = 'tut-meteor';
    });
    later(15000, () => { btn.textContent = 'Vamos lá! ▶'; btn.classList.add('pulse'); });
  }

  function close() {
    timers.forEach(clearTimeout);
    timers = [];
    ov.classList.add('hidden');
    btn.classList.remove('pulse');
    Store.data.tutorial = true;
    Store.save();
    const f = done; done = null;
    if (f) f();
  }
  btn.addEventListener('click', close);

  return { open };
})();
