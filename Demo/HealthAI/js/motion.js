// Shared damped spring. Velocity is pixels/second; cancellation preserves the current frame.
const Motion = (() => {
  const running = new WeakMap();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function cancel(owner) {
    const stop = running.get(owner);
    if (stop) stop();
    running.delete(owner);
  }
  function spring(owner, { from, to, velocity = 0, update, complete = () => {} }) {
    cancel(owner);
    if (reduced.matches) { update(to); complete(); return; }
    let position = from, speed = velocity, frame, last = null, elapsed = 0;
    running.set(owner, () => cancelAnimationFrame(frame));
    function tick(now) {
      // Start in the RAF clock domain and advance only by rendered simulation time.
      // A delayed/background frame must not consume the entire animation at once.
      const dt = last === null ? 1 / 60 : Math.max(0, Math.min((now - last) / 1000, .032));
      last = now;
      elapsed += dt;
      speed += ((to - position) * 240 - speed * 29) * dt;
      position += speed * dt;
      if (reduced.matches || (Math.abs(to - position) < .001 && Math.abs(speed) < .01) || elapsed > 2) {
        running.delete(owner); update(to); complete(); return;
      }
      update(position);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  return { spring, cancel };
})();
