import { useState, useEffect, RefObject } from 'react';

export default function useOnScreen<T extends Element>(ref: RefObject<T>, rootMargin = '0px') {
  const [isIntersecting, setIntersecting] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting), { rootMargin });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return isIntersecting;
}
