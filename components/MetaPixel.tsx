'use client';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

const ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Pixel da Meta: carrega o script e registra PageView a cada troca de página. */
export default function MetaPixel() {
  const path = usePathname();
  const primeira = useRef(true);
  useEffect(() => {
    if (!ID) return;
    if (primeira.current) { primeira.current = false; return; } // a primeira PageView vem do script base
    (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'PageView');
  }, [path]);
  if (!ID || !/^\d{6,20}$/.test(ID)) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${ID}');fbq('track','PageView');`}</Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt="" src={`https://www.facebook.com/tr?id=${ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
