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
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const baseSeed = seed;
  const density = Number(document.body.dataset.starDensity) || 1;

  function draw() {
    seed = baseSeed;
    const width = field.clientWidth;
    const height = field.scrollHeight;
    if (!width || !height) return;
    art.setAttribute('viewBox', `0 0 ${width} ${height}`);
    art.style.height = `${height}px`;
    art.replaceChildren();

    const points: { x: number; y: number; radius: number }[] = [];
    const bands = Math.ceil(height / (370 / density));
    for (let band = 0; band < bands; band++) {
      for (const side of [0, 1]) {
        const count = 1 + Math.floor(random() * 3);
        for (let index = 0; index < count; index++) {
          const x =
            side === 0
              ? 32 + random() * Math.min(280, width * 0.23)
              : width - 32 - random() * Math.min(280, width * 0.23);
          const y = (band + (index + 0.25 + random() * 0.5) / count) * (370 / density);
          if (y < height - 12) points.push({ x, y, radius: 1 + random() * 1.6 });
        }
      }
    }

    for (const point of points) {
      const nearby = points
        .filter((other) => other !== point)
        .map((other) => ({ other, distance: Math.hypot(other.x - point.x, other.y - point.y) }))
        .filter(({ distance }) => distance > 24 && distance < 155)
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearby && random() < 0.48) {
        const line = document.createElementNS(namespace, 'line');
        line.setAttribute('x1', String(point.x));
        line.setAttribute('y1', String(point.y));
        line.setAttribute('x2', String(nearby.other.x));
        line.setAttribute('y2', String(nearby.other.y));
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '0.8');
        line.setAttribute('opacity', '0.55');
        art.append(line);
      }
    }

    for (const point of points) {
      const star = document.createElementNS(namespace, 'circle');
      star.setAttribute('cx', String(point.x));
      star.setAttribute('cy', String(point.y));
      star.setAttribute('r', String(point.radius));
      star.setAttribute('fill', 'currentColor');
      art.append(star);
    }
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  new ResizeObserver(schedule).observe(field);
  schedule();
}
