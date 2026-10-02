const main = document.querySelector<HTMLElement>('.star-field .site-main');

if (main) {
  const field = main;
  const namespace = 'http://www.w3.org/2000/svg';
  const art = document.createElementNS(namespace, 'svg');
  art.classList.add('star-field-art');
  art.setAttribute('aria-hidden', 'true');
  art.setAttribute('focusable', 'false');
  field.prepend(art);

  let seed = 2166136261;
  for (const char of location.pathname) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const baseSeed = seed || 1;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const density = Number(document.body.dataset.starDensity) || 1;
  const speed = Number(document.body.dataset.starSpeed);
  const amplitude = Number(document.body.dataset.starAmplitude);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const pointer = { active: false, clientX: 0, clientY: 0 };

  interface Star {
    baseX: number;
    baseY: number;
    x: number;
    y: number;
    phaseX: number;
    phaseY: number;
    frequency: number;
    depth: number;
    linked: boolean;
    circle: SVGCircleElement;
  }

  let stars: Star[] = [];
  let lines: SVGLineElement[] = [];
  let elapsed = 0;
  let previousFrame = 0;
  let animationFrame = 0;
  let resizeFrame = 0;
  let fieldWidth = 0;
  let fieldHeight = 0;

  function render(staticOnly = false) {
    if (!stars.length) return;
    const rect = pointer.active && !staticOnly ? field.getBoundingClientRect() : null;
    const pointerX = rect ? pointer.clientX - rect.left : 0;
    const pointerY = rect ? pointer.clientY - rect.top : 0;

    for (const star of stars) {
      let targetX = star.baseX;
      let targetY = star.baseY;
      if (!staticOnly) {
        targetX +=
          (Math.sin(elapsed * star.frequency + star.phaseX) - Math.sin(star.phaseX)) *
          amplitude *
          0.8;
        targetY +=
          (Math.sin(elapsed * star.frequency * 0.78 + star.phaseY) - Math.sin(star.phaseY)) *
          amplitude *
          0.8;
        // A second, slower oscillator keeps each star on its own irregular-looking path.
        targetX +=
          (Math.sin(elapsed * star.frequency * 0.43 + star.phaseY) - Math.sin(star.phaseY)) *
          amplitude *
          0.22;
        targetY +=
          (Math.cos(elapsed * star.frequency * 0.37 + star.phaseX) - Math.cos(star.phaseX)) *
          amplitude *
          0.18;
        if (rect) {
          targetX += ((pointer.clientX / innerWidth) * 2 - 1) * amplitude * 0.5 * star.depth;
          targetY += ((pointer.clientY / innerHeight) * 2 - 1) * amplitude * 0.5 * star.depth;
          const dx = targetX - pointerX;
          const dy = targetY - pointerY;
          const distance = Math.hypot(dx, dy);
          if (distance < 140) {
            const push = (1 - distance / 140) ** 2 * 18 * (amplitude / 8);
            const angle = distance > 0 ? Math.atan2(dy, dx) : star.phaseX;
            targetX += Math.cos(angle) * push;
            targetY += Math.sin(angle) * push;
          }
        }
      }
      targetX = Math.max(8, Math.min(fieldWidth - 8, targetX));
      targetY = Math.max(8, Math.min(fieldHeight - 8, targetY));
      star.x = staticOnly ? star.baseX : star.x + (targetX - star.x) * 0.1;
      star.y = staticOnly ? star.baseY : star.y + (targetY - star.y) * 0.1;
      star.circle.setAttribute('cx', star.x.toFixed(2));
      star.circle.setAttribute('cy', star.y.toFixed(2));
    }

    const connections: [Star, Star][] = [];
    const used = new Set<string>();
    for (let index = 0; index < stars.length; index++) {
      const star = stars[index]!;
      if (!star.linked) continue;
      let nearestIndex = -1;
      let nearestDistance = 155;
      for (let otherIndex = 0; otherIndex < stars.length; otherIndex++) {
        if (index === otherIndex) continue;
        const other = stars[otherIndex]!;
        const distance = Math.hypot(other.x - star.x, other.y - star.y);
        if (distance > 24 && distance < nearestDistance) {
          nearestIndex = otherIndex;
          nearestDistance = distance;
        }
      }
      if (nearestIndex < 0) continue;
      const key = `${Math.min(index, nearestIndex)}:${Math.max(index, nearestIndex)}`;
      if (used.has(key)) continue;
      used.add(key);
      connections.push([star, stars[nearestIndex]!]);
    }
    for (let index = 0; index < connections.length; index++) {
      const [from, to] = connections[index]!;
      let line = lines[index];
      if (!line) {
        line = document.createElementNS(namespace, 'line');
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '0.8');
        line.setAttribute('opacity', '0.55');
        art.prepend(line);
        lines.push(line);
      }
      line.style.display = '';
      line.setAttribute('x1', from.x.toFixed(2));
      line.setAttribute('y1', from.y.toFixed(2));
      line.setAttribute('x2', to.x.toFixed(2));
      line.setAttribute('y2', to.y.toFixed(2));
    }
    for (let index = connections.length; index < lines.length; index++) {
      lines[index]!.style.display = 'none';
    }
  }

  function animate(now: number) {
    if (previousFrame) elapsed += Math.min((now - previousFrame) / 1000, 0.05) * speed;
    previousFrame = now;
    render();
    animationFrame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousFrame = 0;
    if (document.hidden || reducedMotion.matches || amplitude === 0) {
      pointer.active = false;
      render(true);
    } else {
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function rebuild() {
    seed = baseSeed;
    fieldWidth = field.clientWidth;
    fieldHeight = field.scrollHeight;
    if (!fieldWidth || !fieldHeight) return;
    art.setAttribute('viewBox', `0 0 ${fieldWidth} ${fieldHeight}`);
    art.style.height = `${fieldHeight}px`;
    art.replaceChildren();
    lines = [];
    stars = [];
    const bandHeight = 280 / density;
    for (let band = 0; band < Math.ceil(fieldHeight / bandHeight); band++) {
      for (const side of [0, 1]) {
        const count = 3 + Math.floor(random() * 4);
        for (let index = 0; index < count; index++) {
          const x =
            side === 0
              ? 32 + random() * Math.min(280, fieldWidth * 0.23)
              : fieldWidth - 32 - random() * Math.min(280, fieldWidth * 0.23);
          const y = (band + (index + 0.25 + random() * 0.5) / count) * bandHeight;
          if (y >= fieldHeight - 12) continue;
          const circle = document.createElementNS(namespace, 'circle');
          circle.setAttribute('r', String(1 + random() * 1.6));
          circle.setAttribute('fill', 'currentColor');
          art.append(circle);
          stars.push({
            baseX: x,
            baseY: y,
            x,
            y,
            phaseX: random() * Math.PI * 2,
            phaseY: random() * Math.PI * 2,
            frequency: (Math.PI * 2) / (12 + random() * 10),
            depth: 0.4 + random() * 0.6,
            linked: random() < 0.48,
            circle,
          });
        }
      }
    }
    render(reducedMotion.matches);
    if (!animationFrame) syncMotion();
  }

  field.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
    pointer.active = true;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
  });
  field.addEventListener('pointerleave', () => {
    pointer.active = false;
  });
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(rebuild);
  }).observe(field);
}
