'use client';

import { useEffect, useRef } from 'react';

export function UnsafeRender({ userHtml }: { userHtml: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = userHtml;
    }
  }, [userHtml]);
  return <div ref={ref} />;
}
